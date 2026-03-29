import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['user', 'lead', 'admin'], 
    default: 'user' 
  },
  profilePicture: { type: String, default: null },
  lastLogin: { type: Date, default: null },
  loginCount: { type: Number, default: 0 },
  circle: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  team: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
export default User;