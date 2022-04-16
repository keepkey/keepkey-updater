// based on https://gist.github.com/joshua-gould/58e1b114a67127273eef239ec0af8989
const fs = require('fs');
const nodeFetch = require('node-fetch');

const Request = nodeFetch.Request;
const Response = nodeFetch.Response;

module.exports = async function fetch(url, options) {
  const request = new Request(url, options);
  const urlObj = new URL(request.url)
  if (urlObj.protocol !== 'file:') return await nodeFetch(url, options);

  const filePath = urlObj.pathname
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return new Response(fs.createReadStream(filePath), {
    url: request.url,
    status: 200,
    statusText: 'OK',
    headers: {
      'Content-Length': fs.statSync(filePath).size
    },
    timeout: request.timeout
  });
};
