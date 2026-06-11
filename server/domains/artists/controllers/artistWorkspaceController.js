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

exports.updateAsset = async (req, res) => {
  try {
    const data = await workspace.updateAsset(artistIdParam(req), req.params.assetId, req.body);
    res.json(data);
  } catch (err) {
    sendError(res, err, 400);
  }
};

exports.deleteAsset = async (req, res) => {
  try {
    await workspace.deleteAsset(artistIdParam(req), req.params.assetId);
    res.status(204).end();
  } catch (err) {
    sendError(res, err);
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

exports.updateReleaseCampaign = async (req, res) => {
  try {
    const data = await workspace.updateReleaseCampaign(artistIdParam(req), req.params.releaseId, req.body);
    res.json(data);
  } catch (err) {
    sendError(res, err, 400);
  }
};

exports.deleteReleaseCampaign = async (req, res) => {
  try {
    await workspace.deleteReleaseCampaign(artistIdParam(req), req.params.releaseId);
    res.status(204).end();
  } catch (err) {
    sendError(res, err);
  }
};
