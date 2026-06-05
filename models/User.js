const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: '??' },
  followers: { type: Number, default: 0 },
  following: { type: Number, default: 0 },
  walletBalance: { type: Number, default: 0 },
  cryptoAssets: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
