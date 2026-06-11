const workspace = require('../services/artistWorkspaceService');

const artistIdParam = (req) => req.params.id;

function sendError(res, err, fallbackStatus = 500) {
  const status = err.statusCode || err.status || fallbackStatus;
  res.status(status).json({ message: err.message });
}

exports.getAssets = async (req, res) => {
  try {
    const data = await workspace.listAssets(artistIdParam(req));
    res.json(data);
  } catch (err) {
    sendError(res, err);
  }
};

exports.createAsset = async (req, res) => {
  try {
    const data = await workspace.createAsset(artistIdParam(req), req.body, req.user);
    res.status(201).json(data);
  } catch (err) {
    sendError(res, err, 400);
  }
};

exports.getReleaseCampaigns = async (req, res) => {
  try {
    const data = await workspace.listReleaseCampaigns(artistIdParam(req));
    res.json(data);
  } catch (err) {
    sendError(res, err);
  }
};

exports.createReleaseCampaign = async (req, res) => {
  try {
    const data = await workspace.createReleaseCampaign(artistIdParam(req), req.body);
    res.status(201).json(data);
  } catch (err) {
    sendError(res, err, 400);
  }
};
