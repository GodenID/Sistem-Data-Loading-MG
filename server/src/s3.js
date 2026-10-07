const AWS = require('aws-sdk');

const S3_BUCKET = process.env.S3_BUCKET || 'loading';
const S3_ENDPOINT = (process.env.S3_ENDPOINT || 'https://s3.ap-southeast-1.onidel.cloud').replace(/\/+$/, '');
const S3_HOST = new URL(S3_ENDPOINT).hostname;

const s3 = new AWS.S3({
  endpoint: S3_ENDPOINT,
  region: process.env.S3_REGION || 'ap-southeast-1',
  s3ForcePathStyle: true,
  signatureVersion: 'v4',
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
});

// URL file S3 (path-style: https://endpoint/bucket/key) -> key tanpa bucket.
// Return null kalau URL bukan dari bucket kita (cegah SSRF via endpoint media).
function keyFromUrl(fileUrl) {
  try {
    const u = new URL(fileUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.hostname !== S3_HOST) return null;
    let key = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
    const prefix = `${S3_BUCKET}/`;
    if (key.startsWith(prefix)) key = key.slice(prefix.length);
    if (!key || key.includes('..')) return null;
    return key;
  } catch {
    return null;
  }
}

module.exports = { s3, S3_BUCKET, S3_ENDPOINT, S3_HOST, keyFromUrl };
