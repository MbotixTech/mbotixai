require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const fetch = require('node-fetch');
const multer = require('multer');
const sharp = require('sharp');
const mime = require('mime-types');

const isVercel = !!process.env.VERCEL;

const upload = multer({
  storage: isVercel
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = path.join(__dirname, 'uploads');
          fs.mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          cb(null, `${Date.now()}-${file.originalname}`);
        },
      }),
});

const app = express();
const port = process.env.PORT || 3000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use('/images', express.static(path.join(__dirname, 'temp/images')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/generate', (req, res) => {
  const styleParam = req.query.style;
  const functionParam = req.query.function;
  if (styleParam === '1') return res.redirect('/landing.html?function=style');
  if (functionParam === 'edit' || functionParam === 'free') {
    return res.redirect(`/landing.html?function=${functionParam}`);
  }
  res.sendFile(path.join(__dirname, 'public/landing.html'));
});

app.post('/generate', upload.single('image'), async (req, res) => {
  const topic = req.body.topic?.trim();
  const customPrompt = req.body.prompt?.trim();
  const selectedFunction = req.body.function;
  const tempDir = './temp/images';
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  try {
    console.log(`🔄 Menjalankan fungsi: ${selectedFunction}`);

    const getImageBuffer = async () => {
      if (isVercel && req.file && req.file.buffer) {
        return req.file.buffer;
      } else {
        return fs.readFileSync(req.file.path);
      }
    };

    if (selectedFunction === 'edit') {
      if (!req.file || !customPrompt) return res.status(400).send('Gambar dan prompt harus disediakan.');
    
      const buffer = await getImageBuffer();
      const convertedBuffer = await sharp(buffer).png().toBuffer();
    
      const imageStream = require('stream').Readable.from(convertedBuffer);
    
      const response = await openai.images.edit({
        image: imageStream,
        prompt: customPrompt,
        n: 1,
        size: '1024x1024',
      });
    
      const imageUrl = response.data[0].url;
      const imgBuffer = await (await fetch(imageUrl)).arrayBuffer();
      const outPath = path.join(tempDir, `edited_${Date.now()}.png`);
      fs.writeFileSync(outPath, Buffer.from(imgBuffer));
      return res.json({ file: `/images/${path.basename(outPath)}` });
    }    

    if (selectedFunction === 'free') {
      if (!customPrompt) return res.status(400).send('Prompt harus disediakan.');
      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: customPrompt,
        n: 1,
        size: '1024x1024',
      });

      const imageUrl = response.data[0].url;
      const imgBuffer = await (await fetch(imageUrl)).arrayBuffer();
      const outPath = path.join(tempDir, `free_${Date.now()}.png`);
      fs.writeFileSync(outPath, Buffer.from(imgBuffer));
      return res.json({ file: `/images/${path.basename(outPath)}` });
    }

    if (selectedFunction === 'style') {
      if (!topic) return res.status(400).send('Topik harus disediakan.');
      const stylePrompt = `concept art of ${topic}, fantasy lighting, beautiful atmosphere, ultra detailed`;
      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: stylePrompt,
        n: 1,
        size: '1024x1024',
      });

      const imageUrl = response.data[0].url;
      const imgBuffer = await (await fetch(imageUrl)).arrayBuffer();
      const outPath = path.join(tempDir, `style_${Date.now()}.png`);
      fs.writeFileSync(outPath, Buffer.from(imgBuffer));
      return res.json({ file: `/images/${path.basename(outPath)}` });
    }

    return res.status(400).send('Fungsi tidak valid.');
  } catch (error) {
    console.error('❌ Terjadi error:', error);
    res.status(500).send('Terjadi kesalahan saat generate/edit gambar');
  }
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public/404.html'));
});

app.listen(port, () => {
  console.log(`🚀 Server berjalan di http://localhost:${port}`);
});
