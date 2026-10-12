import os
import re
import json
import xml.etree.ElementTree as ET
from html.parser import HTMLParser

class Validator(HTMLParser):
    def __init__(self, filename):
        super().__init__()
        self.filename = filename
        self.ids = []
        self.h1_count = 0
        self.headings = []
        self.images_without_alt = []
        self.json_ld_blocks = []
        self.in_json_ld = False
        self.current_json_ld = ''

    def handle_starttag(self, tag, attrs):
        attr_dict = dict(attrs)
        if 'id' in attr_dict:
            self.ids.append((attr_dict['id'], self.getpos()))
        if tag == 'h1':
            self.h1_count += 1
        if tag in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
            self.headings.append((tag, attr_dict.get('id', 'no-id'), self.getpos()))
        if tag == 'img':
            if 'alt' not in attr_dict:
                self.images_without_alt.append((attr_dict.get('src', 'unknown'), self.getpos()))
        if tag == 'script' and attr_dict.get('type') == 'application/ld+json':
            self.in_json_ld = True
            self.current_json_ld = ''

    def handle_endtag(self, tag):
        if tag == 'script' and self.in_json_ld:
            self.in_json_ld = False
            self.json_ld_blocks.append(self.current_json_ld)

    def handle_data(self, data):
        if self.in_json_ld:
            self.current_json_ld += data

html_files = ['index.html', 'editor/index.html', '404.html', 'privacy.html']
print('=== RUNNING COMPREHENSIVE QA CHECKS ===')

all_passed = True
for f in html_files:
    if not os.path.exists(f):
        print(f'FAIL: {f} does not exist!')
        all_passed = False
        continue
    with open(f, 'r', encoding='utf-8') as fp:
        content = fp.read()
    v = Validator(f)
    v.feed(content)
    
    # Check duplicate IDs
    seen_ids = set()
    dup_ids = []
    for id_val, pos in v.ids:
        if id_val in seen_ids:
            dup_ids.append((id_val, pos))
        seen_ids.add(id_val)
    if dup_ids:
        print(f'FAIL [{f}]: Duplicate IDs: {dup_ids}')
        all_passed = False
    else:
        print(f'PASS [{f}]: {len(seen_ids)} unique IDs, zero duplicates.')
        
    # Check H1 count
    if v.h1_count != 1:
        print(f'FAIL [{f}]: Found {v.h1_count} <h1> tags! Expected exactly 1.')
        all_passed = False
    else:
        print(f'PASS [{f}]: Exactly 1 <h1> tag found.')
        
    # Check Images without alt
    if v.images_without_alt:
        print(f'FAIL [{f}]: Images missing alt attribute: {v.images_without_alt}')
        all_passed = False
    else:
        print(f'PASS [{f}]: All images have alt attributes.')
        
    # Validate JSON-LD
    for idx, block in enumerate(v.json_ld_blocks):
        try:
            parsed = json.loads(block)
            block_type = parsed.get("@type", "Graph with " + str(len(parsed.get("@graph", []))) + " items")
            print(f'PASS [{f}]: JSON-LD block {idx+1} valid. Type: {block_type}')
        except Exception as e:
            print(f'FAIL [{f}]: JSON-LD block {idx+1} invalid: {e}')
            all_passed = False

# Validate sitemap.xml
try:
    tree = ET.parse('sitemap.xml')
    root = tree.getroot()
    urls = [elem.text for elem in root.findall('{http://www.sitemaps.org/schemas/sitemap/0.9}url/{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
    print(f'PASS [sitemap.xml]: Valid XML. Found {len(urls)} URLs: {urls}')
except Exception as e:
    print(f'FAIL [sitemap.xml]: {e}')
    all_passed = False

# Validate robots.txt
try:
    with open('robots.txt', 'r', encoding='utf-8') as rfp:
        lines = rfp.readlines()
    sitemap_lines = [l.strip() for l in lines if 'Sitemap:' in l]
    print(f'PASS [robots.txt]: Found {len(lines)} lines. Sitemap directive: {sitemap_lines}')
except Exception as e:
    print(f'FAIL [robots.txt]: {e}')
    all_passed = False

# Check internal anchor targets in index.html
with open('index.html', 'r', encoding='utf-8') as ifp:
    idx_content = ifp.read()
    
internal_anchors = re.findall(r'href="#([a-zA-Z0-9_\-]+)"', idx_content)
all_ids_in_index = set(re.findall(r'id="([a-zA-Z0-9_\-]+)"', idx_content))
broken_anchors = [a for a in internal_anchors if a not in all_ids_in_index]
if broken_anchors:
    print(f'FAIL [index.html]: Broken hash links (target id missing): {broken_anchors}')
    all_passed = False
else:
    print(f'PASS [index.html]: All {len(internal_anchors)} hash links match real existing element IDs: {set(internal_anchors)}')

print('=== QA SUMMARY: ' + ('ALL TESTS PASSED PERFECTLY!' if all_passed else 'ERRORS ENCOUNTERED') + ' ===')
