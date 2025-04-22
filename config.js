const multer = require('multer');

const isVercel = process.env.VERCEL === '1';

const upload = isVercel
  ? multer({ storage: multer.memoryStorage() })
  : multer({ dest: 'uploads/' });

module.exports = { isVercel, upload };
