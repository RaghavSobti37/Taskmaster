const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getNotes, createNote, updateNote, deleteNote } = require('../controllers/noteController');

router.use(protect);
router.get('/', getNotes);
router.post('/', createNote);
router.put('/:id', updateNote);
router.delete('/:id', deleteNote);

module.exports = router;
