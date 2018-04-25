// the following is a workaround:
// Cloud Storage library tries to write in /home/ when uploading a buffer
process.env.HOME = '/tmp';

const puppeteer = require('puppeteer');
const express = require('express');
const Storage = require('@google-cloud/storage');
const storage = new Storage();

const app = express();

app.use(async (req, res) => {
  if(req.path === '/') {return res.end('Please provide URL, example: /http://example.com');}

  // make sure the URL starts with a protocol
  if(!req.path.startsWith('/http')) {return res.status(400).send('URL must start with http:// or https://');}

  const url = req.path.slice(1);
  console.log(`URL: ${url} - starting screenshot`);
  
  const browser = await puppeteer.launch({
    headless: true,
    timeout: 90000,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto(url);

  // Custom CSS to avoid capturing blinking cursors when input fields have focus
  const hideInputTextCSS = `
    input {
      color: transparent;
      text-shadow: 0 0 0 black;
    }
    input:focus {
      outline: none;
    }
  `;
  await page.addStyleTag({ content: hideInputTextCSS });
  let imageBuffer = await page.screenshot();
  await browser.close();

  console.log(`URL: ${url} - screenshot taken`);
  
  // Uploads a local file to the bucket

  console.log(`URL: ${url} - saving screenshot to GCS bucket: ${process.env.SCREENSHOT_BUCKET_NAME}`);
  const bucketName = process.env.SCREENSHOT_BUCKET_NAME;
  const bucket = storage.bucket(bucketName);
  
  const date = new Date();
  const timestamp = date.getTime();
  const filename = `${timestamp}.png`;
  const filepath = url.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const file = bucket.file(`screenshots/${filepath}/${filename}`);
  await file.save(imageBuffer);

  console.log(`URL: ${url} - screenshot saved`);

  // returns the screenshot
  res.set('Content-Type', 'image/png')
  res.send(imageBuffer);
})

const server = app.listen(process.env.PORT || 8080, err => {
  if (err) return console.error(err);
  const port = server.address().port;
  console.log(`App listening on port ${port}`);
});