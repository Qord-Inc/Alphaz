const express = require('express');
const router = express.Router();
const threadsController = require('../../controllers/create/threadsController');

// Thread CRUD
router.get('/threads', threadsController.listThreads);
router.post('/threads', threadsController.createThread);
router.get('/threads/:id', threadsController.getThread);
router.put('/threads/:id', threadsController.updateThread);
router.delete('/threads/:id', threadsController.deleteThread);

// Messages
router.post('/threads/:id/messages', threadsController.addMessage);

// Drafts
router.post('/threads/:id/drafts', threadsController.saveDraft);
router.get('/drafts/:draftId', threadsController.getDraft);
router.put('/drafts/:draftId', threadsController.updateDraftVersion);
router.delete('/drafts/:draftId', threadsController.deleteDraft);

module.exports = router;
