import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['user', 'lead', 'admin', 'server_admin'], 
    default: 'user' 
  },
  profilePicture: { type: String, default: null },
  lastLogin: { type: Date, default: null },
  loginCount: { type: Number, default: 0 },
  isDisabled: { type: Boolean, default: false },
  loginHistory: [
    {
      loginTime: { type: Date, default: Date.now },
      logoutTime: { type: Date, default: null },
      ipAddress: String,
      userAgent: String,
      sessionId: String
    }
  ],
  circle: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  team: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  projects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
export default User;