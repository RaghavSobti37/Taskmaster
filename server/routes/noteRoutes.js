const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getNotes, getNote, createNote, updateNote, deleteNote } = require('../controllers/noteController');
const { validateBody } = require('../validation/validateBody');
const { createNoteBody, updateNoteBody } = require('../validation/schemas/notes');

router.use(protect);
router.get('/', getNotes);
router.get('/:id', getNote);
router.post('/', validateBody(createNoteBody), createNote);
router.put('/:id', validateBody(updateNoteBody), updateNote);
router.delete('/:id', deleteNote);

module.exports = router;
