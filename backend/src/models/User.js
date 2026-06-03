const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    publicId: {
      type: String,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    refreshToken: {
      type: String,
      select: false,
    },
    avatar: {
      type: String,
      default: null,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    bannedAt: Date,
    bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    banReason: String,
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: Date,
    lastLogin: Date,
    lastLoginIP: String,
    postCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    timeoutUntil: { type: Date, default: null },
    timeoutBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    timeoutReason: { type: String, default: null },
    // Single-device session tracking
    activeSession: {
      fingerprint: { type: String, default: null },
      deviceBrand: { type: String, default: null },
      deviceModel: { type: String, default: null },
      deviceOs:    { type: String, default: null },
      userAgent:   { type: String, default: null },
      ip:          { type: String, default: null },
      lastSeen:    { type: Date,   default: null },
      _id: false,
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.publicId) {
    let id, exists;
    do {
      id = String(Math.floor(100000 + Math.random() * 900000));
      exists = await mongoose.model('User').exists({ publicId: id });
    } while (exists);
    this.publicId = id;
  }
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

userSchema.methods.incrementLoginAttempts = async function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({ $set: { loginAttempts: 1 }, $unset: { lockUntil: 1 } });
  }
  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: new Date(Date.now() + 15 * 60 * 1000) };
  }
  return this.updateOne(updates);
};

// Never expose password in JSON responses
userSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.password;
    delete ret.refreshToken;
    delete ret.loginAttempts;
    delete ret.lockUntil;
    delete ret.lastLoginIP;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
