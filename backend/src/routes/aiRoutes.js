const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { digitizeMenu, parseVoiceOrder, getUpsellSuggestions, getInventoryForecast } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

// Multer for menu image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, process.env.UPLOAD_PATH || './uploads');
    },
    filename: (req, file, cb) => {
        cb(null, `menu-${Date.now()}${path.extname(file.originalname)}`);
    },
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/heic', 'image/heif'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, PNG, WebP, and HEIC images are allowed'), false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 15728640 },
    fileFilter,
});

router.use(protect);

router.post('/menu-digitizer', upload.single('menuImage'), digitizeMenu);
router.post('/voice-kot', parseVoiceOrder);
router.post('/upsell', getUpsellSuggestions);
router.get('/inventory-forecast', getInventoryForecast);

module.exports = router;
