require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const fetch = require('node-fetch');
const multer = require('multer');
const sharp = require('sharp');
const mime = require('mime-types'); 
const upload = multer({ storage: multer.memoryStorage() });
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

  if (styleParam === '1') {
    return res.redirect('/landing.html?function=style');
  }

  if (functionParam === 'edit' || functionParam === 'free') {
    return res.redirect(`/landing.html?function=${functionParam}`);
  }

  res.sendFile(path.join(__dirname, 'public/landing.html'));
});

app.post('/generate', upload.single('image'), async (req, res) => {
  const topic = req.body.topic?.trim();
  const customPrompt = req.body.prompt?.trim();
  const selectedFunction = req.body.function;
  const imagePath = req.file ? req.file.path : null;

  const tempDir = './temp/images';
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  try {
    console.log(`🔄 Menjalankan fungsi: ${selectedFunction}`);

    if (selectedFunction === 'edit') {
      if (!imagePath || !customPrompt) {
        return res.status(400).send('Untuk edit, gambar dan prompt harus disediakan.');
      }

      const response = await openai.images.edit({
        image: fs.createReadStream(imagePath),
        prompt: customPrompt,
        n: 1,
        size: '1024x1024',
      });

      const imageUrl = response.data[0].url;
      const buffer = await (await fetch(imageUrl)).arrayBuffer();
      const fileName = `edited_${Date.now()}.png`;
      const fullPath = path.join(tempDir, fileName);
      fs.writeFileSync(fullPath, Buffer.from(buffer));
      console.log(`✅ Gambar berhasil diedit: ${fullPath}`);
      return res.json({ file: `/images/${fileName}` });
    }

    else if (selectedFunction === 'free') {
      if (!customPrompt) {
        return res.status(400).send('Untuk fungsi bebas, prompt harus disediakan.');
      }

      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: customPrompt,
        n: 1,
        size: '1024x1024',
      });

      const imageUrl = response.data[0].url;
      const buffer = await (await fetch(imageUrl)).arrayBuffer();
      const fileName = `free_${Date.now()}.png`;
      const fullPath = path.join(tempDir, fileName);
      fs.writeFileSync(fullPath, Buffer.from(buffer));
      console.log(`✅ Gambar bebas berhasil dibuat: ${fullPath}`);
      return res.json({ file: `/images/${fileName}` });
    }

    else if (selectedFunction === 'style') {
      if (!topic) {
        return res.status(400).send('Untuk style prompt, topik harus disediakan.');
      }

      const stylePrompt = `concept art of ${topic}, fantasy lighting, beautiful atmosphere, ultra detailed`;

      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: stylePrompt,
        n: 1,
        size: '1024x1024',
      });

      const imageUrl = response.data[0].url;
      const buffer = await (await fetch(imageUrl)).arrayBuffer();
      const fileName = `style_${Date.now()}.png`;
      const fullPath = path.join(tempDir, fileName);
      fs.writeFileSync(fullPath, Buffer.from(buffer));
      console.log(`✅ Gambar dengan style berhasil dibuat: ${fullPath}`);
      return res.json({ file: `/images/${fileName}` });
    }

    else {
      return res.status(400).send('Fungsi yang dipilih tidak valid.');
    }

  } catch (error) {
    console.error('❌ Terjadi error:', error);
    return res.status(500).send('Terjadi kesalahan saat generate/edit gambar');
  }
});


app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public/404.html'));
});

app.listen(port, () => {
  console.log(`🚀 Server berjalan di http://localhost:${port}`);
});
