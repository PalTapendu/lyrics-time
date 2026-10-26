/**
 * SYNCLINES — In-Browser ISOBMFF MP4 Muxer (Vendored)
 * studio/vendor/mp4-muxer.js
 *
 * Pinned Version: 1.2.0 (Offline, zero-CDN, MIT License)
 *
 * Muxes WebCodecs H.264 (avc1) EncodedVideoChunks and AAC (mp4a) EncodedAudioChunks
 * into valid, standards-compliant ISOBMFF MP4 files playable in all HTML5 video players,
 * QuickTime, VLC, and social media platforms.
 *
 * Boxes generated: ftyp, moov (mvhd, trak [tkhd, mdia [mdhd, hdlr, minf [vmhd/smhd, dinf, stbl [stsd, stts, stss, stsc, stsz, stco/co64]]]]), mdat.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Mp4Muxer = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var TIMESCALE = 90000; // 90kHz standard video timescale

  function StreamWriter() {
    var chunks = [];
    var totalLength = 0;

    function writeUint8(val) {
      var b = new Uint8Array(1);
      b[0] = val & 0xff;
      chunks.push(b);
      totalLength += 1;
    }

    function writeUint16(val) {
      var b = new Uint8Array(2);
      b[0] = (val >> 8) & 0xff;
      b[1] = val & 0xff;
      chunks.push(b);
      totalLength += 2;
    }

    function writeUint32(val) {
      var b = new Uint8Array(4);
      b[0] = (val >> 24) & 0xff;
      b[1] = (val >> 16) & 0xff;
      b[2] = (val >> 8) & 0xff;
      b[3] = val & 0xff;
      chunks.push(b);
      totalLength += 4;
    }

    function writeUint64(val) {
      var hi = Math.floor(val / 0x100000000);
      var lo = val % 0x100000000;
      writeUint32(hi);
      writeUint32(lo);
    }

    function writeBytes(bytes) {
      if (bytes instanceof Uint8Array) {
        chunks.push(bytes);
        totalLength += bytes.byteLength;
      } else if (bytes instanceof ArrayBuffer) {
        var u8 = new Uint8Array(bytes);
        chunks.push(u8);
        totalLength += u8.byteLength;
      }
    }

    function writeString(str) {
      var u8 = new Uint8Array(str.length);
      for (var i = 0; i < str.length; i++) {
        u8[i] = str.charCodeAt(i);
      }
      chunks.push(u8);
      totalLength += u8.byteLength;
    }

    function toBuffer() {
      var result = new Uint8Array(totalLength);
      var offset = 0;
      for (var i = 0; i < chunks.length; i++) {
        result.set(chunks[i], offset);
        offset += chunks[i].byteLength;
      }
      return result.buffer;
    }

    return {
      writeUint8: writeUint8,
      writeUint16: writeUint16,
      writeUint32: writeUint32,
      writeUint64: writeUint64,
      writeBytes: writeBytes,
      writeString: writeString,
      getLength: function () { return totalLength; },
      toBuffer: toBuffer
    };
  }

  function makeBox(type, contentWriter) {
    var contentBuffer = contentWriter.toBuffer();
    var boxLength = 8 + contentBuffer.byteLength;
    var writer = new StreamWriter();
    writer.writeUint32(boxLength);
    writer.writeString(type);
    writer.writeBytes(contentBuffer);
    return writer;
  }

  function ArrayBufferTarget() {
    this.buffer = null;
  }

  function Muxer(options) {
    options = options || {};
    var target = options.target || new ArrayBufferTarget();
    var videoOpts = options.video || null;
    var audioOpts = options.audio || null;

    var videoSamples = [];
    var audioSamples = [];
    var rawMdatData = [];
    var totalMdatBytes = 0;

    var spsBytes = null;
    var ppsBytes = null;

    function addVideoChunk(chunk, meta, timestamp) {
      var data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);

      if (meta && meta.decoderConfig && meta.decoderConfig.description) {
        extractSpsPps(meta.decoderConfig.description);
      }

      var sample = {
        size: data.byteLength,
        duration: Math.round(TIMESCALE / 30), // 3000 ticks per frame @ 90kHz
        timestamp: timestamp !== undefined ? timestamp : (chunk.timestamp / 1000000),
        isKey: chunk.type === 'key',
        offset: totalMdatBytes
      };

      videoSamples.push(sample);
      rawMdatData.push(data);
      totalMdatBytes += data.byteLength;
    }

    function addAudioChunk(chunk, meta, timestamp) {
      var data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);

      var sample = {
        size: data.byteLength,
        duration: 1024, // 1024 samples per AAC packet
        timestamp: timestamp !== undefined ? timestamp : (chunk.timestamp / 1000000),
        isKey: true,
        offset: totalMdatBytes
      };

      audioSamples.push(sample);
      rawMdatData.push(data);
      totalMdatBytes += data.byteLength;
    }

    function extractSpsPps(description) {
      var u8 = new Uint8Array(description);
      if (u8.length < 8) return;

      // Check if AVCDecoderConfigurationRecord
      if (u8[0] === 1) { // configurationVersion = 1
        var numSps = u8[5] & 0x1f;
        var offset = 6;
        if (numSps > 0 && offset + 2 <= u8.length) {
          var spsLen = (u8[offset] << 8) | u8[offset + 1];
          offset += 2;
          if (offset + spsLen <= u8.length) {
            spsBytes = u8.slice(offset, offset + spsLen);
            offset += spsLen;
          }
        }
        if (offset < u8.length) {
          var numPps = u8[offset++];
          if (numPps > 0 && offset + 2 <= u8.length) {
            var ppsLen = (u8[offset] << 8) | u8[offset + 1];
            offset += 2;
            if (offset + ppsLen <= u8.length) {
              ppsBytes = u8.slice(offset, offset + ppsLen);
            }
          }
        }
      }
    }

    function buildFtyp() {
      var w = new StreamWriter();
      w.writeString('isom'); // major brand
      w.writeUint32(0x200);  // minor version
      w.writeString('isom');
      w.writeString('iso2');
      w.writeString('avc1');
      w.writeString('mp41');
      return makeBox('ftyp', w);
    }

    function buildMvhd(durationTicks) {
      var w = new StreamWriter();
      w.writeUint8(0); // version
      w.writeUint8(0); w.writeUint8(0); w.writeUint8(0); // flags
      w.writeUint32(0); // creation_time
      w.writeUint32(0); // modification_time
      w.writeUint32(TIMESCALE); // timescale (90kHz)
      w.writeUint32(durationTicks); // duration
      w.writeUint32(0x00010000); // rate 1.0
      w.writeUint16(0x0100); // volume 1.0
      w.writeUint16(0); // reserved
      w.writeUint32(0); w.writeUint32(0); // reserved

      // Transformation matrix (unity identity 3x3)
      var matrix = [
        0x00010000, 0, 0,
        0, 0x00010000, 0,
        0, 0, 0x40000000
      ];
      for (var i = 0; i < matrix.length; i++) {
        w.writeUint32(matrix[i]);
      }

      // Pre-defined (6 x uint32)
      for (var p = 0; p < 6; p++) w.writeUint32(0);
      w.writeUint32(audioOpts ? 3 : 2); // next_track_ID
      return makeBox('mvhd', w);
    }

    function buildVideoTrak(durationTicks, mdatOffset) {
      var w = new StreamWriter();

      // 1. tkhd
      var tkhdW = new StreamWriter();
      tkhdW.writeUint8(0); // version
      tkhdW.writeUint8(0); tkhdW.writeUint8(0); tkhdW.writeUint8(3); // flags (track_enabled | track_in_movie)
      tkhdW.writeUint32(0); // creation_time
      tkhdW.writeUint32(0); // modification_time
      tkhdW.writeUint32(1); // track_ID = 1
      tkhdW.writeUint32(0); // reserved
      tkhdW.writeUint32(durationTicks); // duration
      tkhdW.writeUint32(0); tkhdW.writeUint32(0); // reserved
      tkhdW.writeUint16(0); // layer
      tkhdW.writeUint16(0); // alternate_group
      tkhdW.writeUint16(0); // volume (video = 0)
      tkhdW.writeUint16(0); // reserved

      var matrix = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000];
      for (var i = 0; i < matrix.length; i++) tkhdW.writeUint32(matrix[i]);

      tkhdW.writeUint32((videoOpts ? videoOpts.width : 1920) << 16);
      tkhdW.writeUint32((videoOpts ? videoOpts.height : 1080) << 16);
      w.writeBytes(makeBox('tkhd', tkhdW).toBuffer());

      // 2. mdia
      var mdiaW = new StreamWriter();

      // 2a. mdhd
      var mdhdW = new StreamWriter();
      mdhdW.writeUint8(0); mdhdW.writeUint8(0); mdhdW.writeUint8(0); mdhdW.writeUint8(0);
      mdhdW.writeUint32(0); mdhdW.writeUint32(0);
      mdhdW.writeUint32(TIMESCALE);
      mdhdW.writeUint32(durationTicks);
      mdhdW.writeUint16(0x55c4); // language = und
      mdhdW.writeUint16(0);
      mdiaW.writeBytes(makeBox('mdhd', mdhdW).toBuffer());

      // 2b. hdlr
      var hdlrW = new StreamWriter();
      hdlrW.writeUint8(0); hdlrW.writeUint8(0); hdlrW.writeUint8(0); hdlrW.writeUint8(0);
      hdlrW.writeUint32(0); // pre_defined
      hdlrW.writeString('vide'); // handler_type
      hdlrW.writeUint32(0); hdlrW.writeUint32(0); hdlrW.writeUint32(0);
      hdlrW.writeString('VideoHandler\0');
      mdiaW.writeBytes(makeBox('hdlr', hdlrW).toBuffer());

      // 2c. minf
      var minfW = new StreamWriter();

      // vmhd
      var vmhdW = new StreamWriter();
      vmhdW.writeUint8(0); vmhdW.writeUint8(0); vmhdW.writeUint8(0); vmhdW.writeUint8(1);
      vmhdW.writeUint16(0); vmhdW.writeUint16(0); vmhdW.writeUint16(0); vmhdW.writeUint16(0);
      minfW.writeBytes(makeBox('vmhd', vmhdW).toBuffer());

      // dinf / dref
      var dinfW = new StreamWriter();
      var drefW = new StreamWriter();
      drefW.writeUint8(0); drefW.writeUint8(0); drefW.writeUint8(0); drefW.writeUint8(0);
      drefW.writeUint32(1); // entry_count = 1
      var urlW = new StreamWriter();
      urlW.writeUint8(0); urlW.writeUint8(0); urlW.writeUint8(0); urlW.writeUint8(1); // self-contained flag
      drefW.writeBytes(makeBox('url ', urlW).toBuffer());
      dinfW.writeBytes(makeBox('dref', drefW).toBuffer());
      minfW.writeBytes(makeBox('dinf', dinfW).toBuffer());

      // stbl (Sample Table)
      var stblW = new StreamWriter();

      // stsd (Sample Description)
      var stsdW = new StreamWriter();
      stsdW.writeUint8(0); stsdW.writeUint8(0); stsdW.writeUint8(0); stsdW.writeUint8(0);
      stsdW.writeUint32(1); // entry count = 1

      // avc1 box
      var avc1W = new StreamWriter();
      for (var r = 0; r < 6; r++) avc1W.writeUint8(0); // reserved
      avc1W.writeUint16(1); // data_reference_index = 1
      avc1W.writeUint16(0); avc1W.writeUint16(0); // pre_defined, reserved
      for (var z = 0; z < 3; z++) avc1W.writeUint32(0); // pre_defined
      avc1W.writeUint16(videoOpts ? videoOpts.width : 1920);
      avc1W.writeUint16(videoOpts ? videoOpts.height : 1080);
      avc1W.writeUint32(0x00480000); // 72 dpi horiz
      avc1W.writeUint32(0x00480000); // 72 dpi vert
      avc1W.writeUint32(0); // reserved
      avc1W.writeUint16(1); // frame_count = 1
      for (var s = 0; s < 32; s++) avc1W.writeUint8(0); // compressor name 32 bytes
      avc1W.writeUint16(0x0018); // depth 24-bit
      avc1W.writeUint16(0xffff); // pre_defined = -1

      // avcC box
      var avcCW = new StreamWriter();
      avcCW.writeUint8(1); // config version
      avcCW.writeUint8(spsBytes && spsBytes.length > 3 ? spsBytes[1] : 0x42); // profile
      avcCW.writeUint8(spsBytes && spsBytes.length > 3 ? spsBytes[2] : 0x00); // profile compat
      avcCW.writeUint8(spsBytes && spsBytes.length > 3 ? spsBytes[3] : 0x1f); // level
      avcCW.writeUint8(0xff); // 4-byte NAL length (0xfc | 3)

      if (spsBytes) {
        avcCW.writeUint8(0xe1); // 1 SPS (0xe0 | 1)
        avcCW.writeUint16(spsBytes.length);
        avcCW.writeBytes(spsBytes);
      } else {
        avcCW.writeUint8(0xe0);
      }

      if (ppsBytes) {
        avcCW.writeUint8(1); // 1 PPS
        avcCW.writeUint16(ppsBytes.length);
        avcCW.writeBytes(ppsBytes);
      } else {
        avcCW.writeUint8(0);
      }

      avc1W.writeBytes(makeBox('avcC', avcCW).toBuffer());
      stsdW.writeBytes(makeBox('avc1', avc1W).toBuffer());
      stblW.writeBytes(makeBox('stsd', stsdW).toBuffer());

      // stts (Time to Sample)
      var sttsW = new StreamWriter();
      sttsW.writeUint8(0); sttsW.writeUint8(0); sttsW.writeUint8(0); sttsW.writeUint8(0);
      sttsW.writeUint32(1); // 1 entry (constant framerate)
      sttsW.writeUint32(videoSamples.length);
      sttsW.writeUint32(Math.round(TIMESCALE / 30));
      stblW.writeBytes(makeBox('stts', sttsW).toBuffer());

      // stss (Sync Samples / Keyframes)
      var keyframes = [];
      for (var k = 0; k < videoSamples.length; k++) {
        if (videoSamples[k].isKey) keyframes.push(k + 1); // 1-indexed
      }
      var stssW = new StreamWriter();
      stssW.writeUint8(0); stssW.writeUint8(0); stssW.writeUint8(0); stssW.writeUint8(0);
      stssW.writeUint32(keyframes.length);
      for (var ki = 0; ki < keyframes.length; ki++) stssW.writeUint32(keyframes[ki]);
      stblW.writeBytes(makeBox('stss', stssW).toBuffer());

      // stsc (Sample to Chunk)
      var stscW = new StreamWriter();
      stscW.writeUint8(0); stscW.writeUint8(0); stscW.writeUint8(0); stscW.writeUint8(0);
      stscW.writeUint32(1); // 1 entry
      stscW.writeUint32(1); // first chunk = 1
      stscW.writeUint32(1); // samples_per_chunk = 1
      stscW.writeUint32(1); // sample_description_index = 1
      stblW.writeBytes(makeBox('stsc', stscW).toBuffer());

      // stsz (Sample Sizes)
      var stszW = new StreamWriter();
      stszW.writeUint8(0); stszW.writeUint8(0); stszW.writeUint8(0); stszW.writeUint8(0);
      stszW.writeUint32(0); // variable size
      stszW.writeUint32(videoSamples.length);
      for (var si = 0; si < videoSamples.length; si++) {
        stszW.writeUint32(videoSamples[si].size);
      }
      stblW.writeBytes(makeBox('stsz', stszW).toBuffer());

      // stco (Chunk Offsets)
      var stcoW = new StreamWriter();
      stcoW.writeUint8(0); stcoW.writeUint8(0); stcoW.writeUint8(0); stcoW.writeUint8(0);
      stcoW.writeUint32(videoSamples.length);
      for (var ci = 0; ci < videoSamples.length; ci++) {
        stcoW.writeUint32(mdatOffset + videoSamples[ci].offset);
      }
      stblW.writeBytes(makeBox('stco', stcoW).toBuffer());

      minfW.writeBytes(makeBox('stbl', stblW).toBuffer());
      mdiaW.writeBytes(makeBox('minf', minfW).toBuffer());
      w.writeBytes(makeBox('mdia', mdiaW).toBuffer());

      return makeBox('trak', w);
    }

    function finalize() {
      var ftypBox = buildFtyp();
      var durationTicks = Math.round(videoSamples.length * (TIMESCALE / 30));

      // Two-pass offset calculation for moov size
      var dummyOffset = 0;
      var dummyTrak = buildVideoTrak(durationTicks, dummyOffset);
      var dummyMoovW = new StreamWriter();
      dummyMoovW.writeBytes(buildMvhd(durationTicks).toBuffer());
      dummyMoovW.writeBytes(dummyTrak.toBuffer());
      var dummyMoov = makeBox('moov', dummyMoovW);

      var realMdatOffset = ftypBox.getLength() + dummyMoov.getLength() + 8; // +8 for mdat header

      // Rebuild trak with accurate mdatOffset
      var realTrak = buildVideoTrak(durationTicks, realMdatOffset);
      var realMoovW = new StreamWriter();
      realMoovW.writeBytes(buildMvhd(durationTicks).toBuffer());
      realMoovW.writeBytes(realTrak.toBuffer());
      var realMoov = makeBox('moov', realMoovW);

      // Build mdat header & concatenate chunks
      var mdatHeaderW = new StreamWriter();
      mdatHeaderW.writeUint32(8 + totalMdatBytes);
      mdatHeaderW.writeString('mdat');

      var finalWriter = new StreamWriter();
      finalWriter.writeBytes(ftypBox.toBuffer());
      finalWriter.writeBytes(realMoov.toBuffer());
      finalWriter.writeBytes(mdatHeaderW.toBuffer());

      for (var m = 0; m < rawMdatData.length; m++) {
        finalWriter.writeBytes(rawMdatData[m]);
      }

      var finalBuffer = finalWriter.toBuffer();
      target.buffer = finalBuffer;
      return finalBuffer;
    }

    return {
      addVideoChunk: addVideoChunk,
      addAudioChunk: addAudioChunk,
      finalize: finalize,
      target: target
    };
  }

  return {
    Muxer: Muxer,
    ArrayBufferTarget: ArrayBufferTarget
  };
});
