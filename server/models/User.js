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
  circle: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  team: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
export default User;