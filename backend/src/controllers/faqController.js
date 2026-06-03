const FAQ = require('../models/FAQ');
const { logEvent, getRequestMeta } = require('../middleware/logger');

// GET /api/faq  — public
exports.getAll = async (req, res, next) => {
  try {
    const categories = await FAQ.find().sort({ order: 1, createdAt: 1 }).lean();
    res.json({ faq: categories });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/faq
exports.adminGetAll = async (req, res, next) => {
  try {
    const categories = await FAQ.find().sort({ order: 1, createdAt: 1 }).lean();
    res.json({ categories });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/faq  — create category
exports.createCategory = async (req, res, next) => {
  try {
    const { main } = req.body;
    if (!main?.trim()) return res.status(400).json({ error: 'Category name is required' });

    const count = await FAQ.countDocuments();
    const category = await FAQ.create({ main: main.trim(), order: count });

    await logEvent({ category: 'admin', action: 'faq_category_created', severity: 'info', targetType: 'FAQ', targetId: category._id, targetSnapshot: { categoryName: main.trim() }, ...getRequestMeta(req), details: { name: main } });
    res.status(201).json({ category });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Category already exists' });
    next(err);
  }
};

// DELETE /api/admin/faq/:categoryId  — delete entire category
exports.deleteCategory = async (req, res, next) => {
  try {
    const cat = await FAQ.findByIdAndDelete(req.params.categoryId);
    if (!cat) return res.status(404).json({ error: 'Category not found' });

    await logEvent({ category: 'admin', action: 'faq_category_deleted', severity: 'warn', targetType: 'FAQ', targetId: req.params.categoryId, targetSnapshot: { categoryName: cat.main }, ...getRequestMeta(req), details: { name: cat.main } });
    res.json({ message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/faq/:categoryId/questions  — add question to category
exports.addQuestion = async (req, res, next) => {
  try {
    const { question, answer } = req.body;
    if (!question?.trim() || !answer?.trim()) return res.status(400).json({ error: 'Question and answer are required' });

    const cat = await FAQ.findByIdAndUpdate(
      req.params.categoryId,
      { $push: { sub: { question: question.trim(), answer: answer.trim() } } },
      { new: true }
    );
    if (!cat) return res.status(404).json({ error: 'Category not found' });

    const newQ = cat.sub[cat.sub.length - 1];
    await logEvent({ category: 'admin', action: 'faq_question_added', severity: 'info', targetType: 'FAQ', targetId: req.params.categoryId, targetSnapshot: { categoryName: cat.main, questionId: newQ._id }, ...getRequestMeta(req), details: { category: cat.main, question } });
    res.status(201).json({ question: newQ, category: cat });
  } catch (err) {
    next(err);
  }
};

// PUT /api/admin/faq/:categoryId/questions/:questionId  — edit question
exports.updateQuestion = async (req, res, next) => {
  try {
    const { question, answer } = req.body;
    if (!question?.trim() && !answer?.trim()) return res.status(400).json({ error: 'Nothing to update' });

    const update = {};
    if (question?.trim()) update['sub.$.question'] = question.trim();
    if (answer?.trim())   update['sub.$.answer']   = answer.trim();

    const cat = await FAQ.findOneAndUpdate(
      { _id: req.params.categoryId, 'sub._id': req.params.questionId },
      { $set: update },
      { new: true }
    );
    if (!cat) return res.status(404).json({ error: 'Question not found' });

    await logEvent({ category: 'admin', action: 'faq_question_updated', severity: 'info', targetType: 'FAQ', targetId: req.params.categoryId, targetSnapshot: { categoryName: cat.main, questionId: req.params.questionId }, ...getRequestMeta(req), details: { category: cat.main, questionId: req.params.questionId } });
    res.json({ category: cat });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/faq/:categoryId/questions/:questionId
exports.deleteQuestion = async (req, res, next) => {
  try {
    const cat = await FAQ.findByIdAndUpdate(
      req.params.categoryId,
      { $pull: { sub: { _id: req.params.questionId } } },
      { new: true }
    );
    if (!cat) return res.status(404).json({ error: 'Category not found' });

    await logEvent({ category: 'admin', action: 'faq_question_deleted', severity: 'warn', targetType: 'FAQ', targetId: req.params.categoryId, targetSnapshot: { categoryName: cat.main, questionId: req.params.questionId }, ...getRequestMeta(req), details: { category: cat.main, questionId: req.params.questionId } });
    res.json({ category: cat });
  } catch (err) {
    next(err);
  }
};