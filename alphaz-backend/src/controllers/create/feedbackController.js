const supabase = require('../../config/supabase');

// =====================================================
// Save or update feedback on a message
// POST /api/feedback
// Body: { userId, messageId, threadId, feedbackType, feedbackText? }
// =====================================================
async function saveFeedback(req, res) {
  try {
    const { userId, messageId, threadId, feedbackType, feedbackText } = req.body;

    if (!userId || !messageId || !threadId || !feedbackType) {
      return res.status(400).json({ 
        error: 'userId, messageId, threadId, and feedbackType are required' 
      });
    }

    if (!['up', 'down'].includes(feedbackType)) {
      return res.status(400).json({ 
        error: 'feedbackType must be "up" or "down"' 
      });
    }

    // Upsert feedback (replace if exists)
    const { data, error } = await supabase
      .from('message_feedback')
      .upsert({
        user_clerk_id: userId,
        message_id: messageId,
        thread_id: threadId,
        feedback_type: feedbackType,
        feedback_text: feedbackText || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_clerk_id,message_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving feedback:', error);
      return res.status(500).json({ error: 'Failed to save feedback' });
    }

    console.log(`Feedback saved: ${feedbackType} on message ${messageId} by user ${userId}`);
    
    res.json({ 
      success: true, 
      feedback: data 
    });
  } catch (err) {
    console.error('Error in saveFeedback:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// =====================================================
// Get feedback for messages in a thread (for user's own feedback display)
// GET /api/feedback/thread/:threadId?userId=xxx
// =====================================================
async function getThreadFeedback(req, res) {
  try {
    const { threadId } = req.params;
    const { userId } = req.query;

    if (!threadId || !userId) {
      return res.status(400).json({ 
        error: 'threadId and userId are required' 
      });
    }

    const { data, error } = await supabase
      .from('message_feedback')
      .select('id, message_id, feedback_type, feedback_text, created_at, updated_at')
      .eq('thread_id', threadId)
      .eq('user_clerk_id', userId);

    if (error) {
      console.error('Error fetching thread feedback:', error);
      return res.status(500).json({ error: 'Failed to fetch feedback' });
    }

    // Return as a map for easy lookup: { messageId: { type, text } }
    const feedbackMap = {};
    (data || []).forEach(fb => {
      feedbackMap[fb.message_id] = {
        type: fb.feedback_type,
        text: fb.feedback_text
      };
    });

    res.json({ feedback: feedbackMap });
  } catch (err) {
    console.error('Error in getThreadFeedback:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// =====================================================
// Get all feedback (for developer dashboard/analytics)
// GET /api/feedback/all?limit=100&offset=0&type=down
// =====================================================
async function getAllFeedback(req, res) {
  try {
    const { limit = 100, offset = 0, type } = req.query;

    let query = supabase
      .from('message_feedback')
      .select(`
        id,
        user_clerk_id,
        message_id,
        thread_id,
        feedback_type,
        feedback_text,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (type && ['up', 'down'].includes(type)) {
      query = query.eq('feedback_type', type);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching all feedback:', error);
      return res.status(500).json({ error: 'Failed to fetch feedback' });
    }

    res.json({ 
      feedback: data || [],
      count: data?.length || 0
    });
  } catch (err) {
    console.error('Error in getAllFeedback:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// =====================================================
// Delete feedback (optional - if user wants to remove)
// DELETE /api/feedback/:feedbackId
// =====================================================
async function deleteFeedback(req, res) {
  try {
    const { feedbackId } = req.params;
    const { userId } = req.query;

    if (!feedbackId || !userId) {
      return res.status(400).json({ 
        error: 'feedbackId and userId are required' 
      });
    }

    const { error } = await supabase
      .from('message_feedback')
      .delete()
      .eq('id', feedbackId)
      .eq('user_clerk_id', userId);

    if (error) {
      console.error('Error deleting feedback:', error);
      return res.status(500).json({ error: 'Failed to delete feedback' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error in deleteFeedback:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  saveFeedback,
  getThreadFeedback,
  getAllFeedback,
  deleteFeedback
};
