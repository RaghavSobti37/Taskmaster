module.exports = (req, res, next) => {
  if (req.user) {
    req.user.lastOnline = new Date();
    req.user.online = true;
    req.user.save().catch(() => {});
  }
  next();
};
