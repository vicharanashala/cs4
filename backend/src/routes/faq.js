const express = require('express');
const router = express.Router();
const { getAll } = require('../controllers/faqController');

router.get('/', getAll);

module.exports = router;
