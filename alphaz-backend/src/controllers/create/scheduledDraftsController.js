const supabase = require('../../config/supabase');

// GET /api/scheduled-drafts/:clerkUserId
// Get all scheduled drafts for a user (with optional filters)
async function getScheduledDrafts(req, res) {
  try {
    const { clerkUserId } = req.params;
    const { status, organizationId } = req.query;

    if (!clerkUserId) {
      return res.status(400).json({ error: 'Missing clerkUserId' });
    }

    let query = supabase
      .from('scheduled_drafts')
      .select('*')
      .eq('user_clerk_id', clerkUserId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    // Filter by organization: if organizationId provided, filter by it
    // If isPersonal=true, filter for NULL organization_id (personal drafts)
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    } else if (req.query.isPersonal === 'true') {
      query = query.is('organization_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching scheduled drafts:', error);
      return res.status(500).json({ error: 'Failed to fetch scheduled drafts' });
    }

    return res.json({ drafts: data || [] });
  } catch (err) {
    console.error('Error in getScheduledDrafts:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/scheduled-drafts
// Create a new scheduled draft
// Body: { clerkUserId, organizationId?, draftVersionId?, draftId?, threadId?, content, title?, scheduledAt?, notes? }
async function createScheduledDraft(req, res) {
  try {
    const {
      clerkUserId,
      organizationId,
      draftVersionId,
      draftId,
      threadId,
      content,
      title,
      scheduledAt,
      notes
    } = req.body;

    if (!clerkUserId || !content) {
      return res.status(400).json({ error: 'Missing required fields: clerkUserId, content' });
    }

    // Determine status based on scheduledAt
    const status = scheduledAt ? 'scheduled' : 'saved';

    const payload = {
      user_clerk_id: clerkUserId,
      organization_id: organizationId || null,
      draft_version_id: draftVersionId || null,
      draft_id: draftId || null,
      thread_id: threadId || null,
      content,
      title: title || null,
      scheduled_at: scheduledAt || null,
      status,
      notes: notes || null
    };

    const { data, error } = await supabase
      .from('scheduled_drafts')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      console.error('Error creating scheduled draft:', error);
      return res.status(500).json({ error: 'Failed to create scheduled draft' });
    }

    return res.status(201).json({ draft: data });
  } catch (err) {
    console.error('Error in createScheduledDraft:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// PATCH /api/scheduled-drafts/:id
// Update a scheduled draft
// Body: { content?, title?, scheduledAt?, notes?, status? }
async function updateScheduledDraft(req, res) {
  try {
    const { id } = req.params;
    const { content, title, scheduledAt, notes, status } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Missing draft id' });
    }

    const updates = {};
    if (content !== undefined) updates.content = content;
    if (title !== undefined) updates.title = title;
    if (scheduledAt !== undefined) {
      updates.scheduled_at = scheduledAt;
      // Update status based on scheduledAt
      if (scheduledAt && status !== 'posted') {
        updates.status = 'scheduled';
      } else if (!scheduledAt && status !== 'posted') {
        updates.status = 'saved';
      }
    }
    if (notes !== undefined) updates.notes = notes;
    if (status !== undefined) {
      updates.status = status;
      if (status === 'posted') {
        updates.posted_at = new Date().toISOString();
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { data, error } = await supabase
      .from('scheduled_drafts')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating scheduled draft:', error);
      return res.status(500).json({ error: 'Failed to update scheduled draft' });
    }

    return res.json({ draft: data });
  } catch (err) {
    console.error('Error in updateScheduledDraft:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// DELETE /api/scheduled-drafts/:id
// Delete a scheduled draft
async function deleteScheduledDraft(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Missing draft id' });
    }

    const { error } = await supabase
      .from('scheduled_drafts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting scheduled draft:', error);
      return res.status(500).json({ error: 'Failed to delete scheduled draft' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Error in deleteScheduledDraft:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/scheduled-drafts/by-date/:clerkUserId
// Get drafts grouped by date for calendar view
async function getDraftsByDate(req, res) {
  try {
    const { clerkUserId } = req.params;
    const { organizationId } = req.query;

    if (!clerkUserId) {
      return res.status(400).json({ error: 'Missing clerkUserId' });
    }

    let query = supabase
      .from('scheduled_drafts')
      .select('*')
      .eq('user_clerk_id', clerkUserId)
      .eq('status', 'scheduled')
      .not('scheduled_at', 'is', null)
      .order('scheduled_at', { ascending: true });

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching drafts by date:', error);
      return res.status(500).json({ error: 'Failed to fetch drafts by date' });
    }

    // Group by date
    const grouped = {};
    (data || []).forEach(draft => {
      const date = new Date(draft.scheduled_at).toISOString().split('T')[0];
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(draft);
    });

    return res.json({ draftsByDate: grouped });
  } catch (err) {
    console.error('Error in getDraftsByDate:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getScheduledDrafts,
  createScheduledDraft,
  updateScheduledDraft,
  deleteScheduledDraft,
  getDraftsByDate
};
