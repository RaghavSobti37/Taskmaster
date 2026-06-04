const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { protect, admin } = require('../middleware/authMiddleware');
const SCRIPTS_CATALOG = require('../config/adminScriptsCatalog');

const router = express.Router();

const SCRIPTS_DIR = path.join(__dirname, '..', 'scripts');
const SERVER_ROOT = path.join(__dirname, '..');

const formatCommand = (fileName, args = []) => {
  const tail = args.length ? ` ${args.join(' ')}` : '';
  return `node scripts/${fileName}${tail}`;
};

const buildScriptList = () =>
  SCRIPTS_CATALOG.map((entry) => {
    const scriptPath = path.join(SCRIPTS_DIR, entry.fileName);
    const exists = fs.existsSync(scriptPath);
    return {
      ...entry,
      command: formatCommand(entry.fileName, entry.args || []),
      missing: !exists,
    };
  }).filter((entry) => !entry.missing);

router.use(protect, admin);

router.get('/', async (req, res) => {
  try {
    const scripts = buildScriptList();
    res.json({ success: true, data: scripts });
  } catch (error) {
    console.error('List scripts error:', error);
    res.status(500).json({ success: false, message: 'Failed to list scripts' });
  }
});

router.post('/:scriptId/run', async (req, res) => {
  try {
    const { scriptId } = req.params;
    const scripts = buildScriptList();
    const selected = scripts.find((s) => s.id === scriptId);

    if (!selected) {
      return res.status(404).json({ success: false, message: 'Script not found' });
    }

    const scriptPath = path.join(SCRIPTS_DIR, selected.fileName);
    const args = selected.args || [];
    const startedAt = Date.now();

    const child = spawn('node', [scriptPath, ...args], {
      cwd: SERVER_ROOT,
      env: process.env,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      const durationMs = Date.now() - startedAt;
      const ok = code === 0;
      res.status(ok ? 200 : 500).json({
        success: ok,
        data: {
          scriptId: selected.id,
          command: selected.command,
          exitCode: code,
          durationMs,
          stdout,
          stderr,
        },
        message: ok ? 'Script completed successfully' : 'Script failed',
      });
    });
  } catch (error) {
    console.error('Run script error:', error);
    res.status(500).json({ success: false, message: error.message || 'Script execution failed' });
  }
});

module.exports = router;
