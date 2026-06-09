const mongoose = require('mongoose');

const subSchema = new mongoose.Schema({
  question: { type: String, required: true, trim: true },
  answer:   { type: String, required: true, trim: true },
}, { timestamps: true });

const faqSchema = new mongoose.Schema({
  main:  { type: String, required: true, unique: true, trim: true },
  sub:   [subSchema],
  order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('FAQ', faqSchema);
