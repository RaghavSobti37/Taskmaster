const express = require('express');
const router = express.Router();
const OfficeContact = require('../models/OfficeContact');
const { protect, opsOrAdmin, requirePageAccess } = require('../middleware/authMiddleware');

const contactsPage = requirePageAccess('contacts');

router.use(protect);

router.get('/', contactsPage, async (req, res) => {
  try {
    const contacts = await OfficeContact.find()
      .populate('addedBy', 'name email')
      .sort('name');
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching contacts' });
  }
});

router.post('/', contactsPage, async (req, res) => {
  try {
    const contact = new OfficeContact({
      ...req.body,
      addedBy: req.user._id,
    });
    const saved = await contact.save();
    const populated = await OfficeContact.findById(saved._id).populate('addedBy', 'name email');
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create contact' });
  }
});

router.put('/:id', contactsPage, async (req, res) => {
  try {
    const updated = await OfficeContact.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' }).populate('addedBy', 'name email');
    if (!updated) return res.status(404).json({ error: 'Contact not found' });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update contact' });
  }
});

router.delete('/:id', contactsPage, async (req, res) => {
  try {
    await OfficeContact.findByIdAndDelete(req.params.id);
    res.json({ message: 'Contact removed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

module.exports = router;
