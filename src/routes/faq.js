const express = require('express');
const router = express.Router();
const { getAll } = require('../services/faqController');

router.get('/', getAll);

module.exports = router;
