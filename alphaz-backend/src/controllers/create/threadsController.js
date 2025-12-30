const supabase = require('../../config/supabase');

// =====================================================
// List threads for a user/organization
// =====================================================
async function listThreads(req, res) {
  try {
    const { userId, organizationId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    let query = supabase
      .from('chat_threads')
      .select('id, title, organization_id, user_clerk_id, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (organizationId) {
      // Get threads for this org (anyone with org access)
      query = query.eq('organization_id', organizationId);
    } else {
      // Get user's personal threads (no org)
      query = query.eq('user_clerk_id', userId).is('organization_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error listing threads:', error);
      return res.status(500).json({ error: 'Failed to list threads' });
    }

    res.json({ threads: data || [] });
  } catch (err) {
    console.error('Error in listThreads:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// =====================================================
// Create a new thread
// =====================================================
async function createThread(req, res) {
  try {
    const { userId, organizationId, title } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const { data, error } = await supabase
      .from('chat_threads')
      .insert({
        user_clerk_id: userId,
        organization_id: organizationId || null,
        title: title || 'New Thread'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating thread:', error);
      return res.status(500).json({ error: 'Failed to create thread' });
    }

    res.json({ thread: data });
  } catch (err) {
    console.error('Error in createThread:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// =====================================================
// Get a single thread with messages and drafts
// =====================================================
async function getThread(req, res) {
  try {
    const { id } = req.params;
    const { userId, organizationId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Get thread
    const { data: thread, error: threadError } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('id', id)
      .single();

    if (threadError || !thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Check access: user owns it OR it's for an org they have access to
    const hasAccess = thread.user_clerk_id === userId ||
      (organizationId && thread.organization_id === organizationId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get messages
    const { data: messages, error: messagesError } = await supabase
      .from('chat_thread_messages')
      .select('*')
      .eq('thread_id', id)
      .order('seq', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
    }

    // Get drafts with their versions
    const { data: drafts, error: draftsError } = await supabase
      .from('chat_thread_drafts')
      .select(`
        id,
        title,
        current_version,
        created_at,
        updated_at,
        versions:chat_thread_draft_versions(*)
      `)
      .eq('thread_id', id)
      .order('created_at', { ascending: true });

    if (draftsError) {
      console.error('Error fetching drafts:', draftsError);
    }

    res.json({
      thread,
      messages: messages || [],
      drafts: drafts || []
    });
  } catch (err) {
    console.error('Error in getThread:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// =====================================================
// Update thread title
// =====================================================
async function updateThread(req, res) {
  try {
    const { id } = req.params;
    const { userId, title } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Check ownership
    const { data: thread, error: findError } = await supabase
      .from('chat_threads')
      .select('user_clerk_id')
      .eq('id', id)
      .single();

    if (findError || !thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    if (thread.user_clerk_id !== userId) {
      return res.status(403).json({ error: 'Only thread owner can update' });
    }

    const { data, error } = await supabase
      .from('chat_threads')
      .update({ title })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating thread:', error);
      return res.status(500).json({ error: 'Failed to update thread' });
    }

    res.json({ thread: data });
  } catch (err) {
    console.error('Error in updateThread:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// =====================================================
// Delete a thread (cascade deletes messages, drafts, versions)
// =====================================================
async function deleteThread(req, res) {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Check ownership
    const { data: thread, error: findError } = await supabase
      .from('chat_threads')
      .select('user_clerk_id')
      .eq('id', id)
      .single();

    if (findError || !thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    if (thread.user_clerk_id !== userId) {
      return res.status(403).json({ error: 'Only thread owner can delete' });
    }

    const { error } = await supabase
      .from('chat_threads')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting thread:', error);
      return res.status(500).json({ error: 'Failed to delete thread' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error in deleteThread:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// =====================================================
// Add a message to a thread
// =====================================================
async function addMessage(req, res) {
  try {
    const { id } = req.params; // thread id
    const { role, content, intent } = req.body;

    if (!role || !content) {
      return res.status(400).json({ error: 'role and content are required' });
    }

    // Get max seq for this thread
    const { data: maxSeqData } = await supabase
      .from('chat_thread_messages')
      .select('seq')
      .eq('thread_id', id)
      .order('seq', { ascending: false })
      .limit(1);

    const nextSeq = (maxSeqData && maxSeqData[0]?.seq !== undefined) ? maxSeqData[0].seq + 1 : 0;

    const { data, error } = await supabase
      .from('chat_thread_messages')
      .insert({
        thread_id: id,
        role,
        content,
        intent: intent || null,
        seq: nextSeq
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding message:', error);
      return res.status(500).json({ error: 'Failed to add message' });
    }

    // Also update thread's updated_at
    await supabase
      .from('chat_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);

    res.json({ message: data });
  } catch (err) {
    console.error('Error in addMessage:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// =====================================================
// Save a draft (create or update) with a new version
// =====================================================
async function saveDraft(req, res) {
  try {
    const { id } = req.params; // thread id
    const { draftId, title, content, editPrompt, changes, parentMessageId } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    let draft;

    if (draftId) {
      // Update existing draft - add new version
      const { data: existingDraft, error: findError } = await supabase
        .from('chat_thread_drafts')
        .select('id, current_version')
        .eq('id', draftId)
        .single();

      if (findError || !existingDraft) {
        return res.status(404).json({ error: 'Draft not found' });
      }

      const newVersion = existingDraft.current_version + 1;

      // Add new version using upsert to handle race conditions with unique constraint
      const { data: versionData, error: versionError } = await supabase
        .from('chat_thread_draft_versions')
        .upsert({
          draft_id: draftId,
          version: newVersion,
          content,
          edit_prompt: editPrompt || null,
          changes: changes || null,
          parent_message_id: parentMessageId || null
        }, {
          onConflict: 'draft_id,version',
          ignoreDuplicates: false // Update if exists
        })
        .select()
        .single();

      if (versionError) {
        console.error('Error adding draft version:', versionError);
        return res.status(500).json({ error: 'Failed to save draft version' });
      }

      // Update draft's current_version
      const { data: updatedDraft, error: updateError } = await supabase
        .from('chat_thread_drafts')
        .update({ current_version: newVersion, title: title || existingDraft.title })
        .eq('id', draftId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating draft:', updateError);
        return res.status(500).json({ error: 'Failed to update draft' });
      }

      draft = updatedDraft;
    } else {
      // Create new draft
      const { data: newDraft, error: createError } = await supabase
        .from('chat_thread_drafts')
        .insert({
          thread_id: id,
          title: title || 'Draft',
          current_version: 1
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating draft:', createError);
        return res.status(500).json({ error: 'Failed to create draft' });
      }

      // Add first version
      const { error: versionError } = await supabase
        .from('chat_thread_draft_versions')
        .insert({
          draft_id: newDraft.id,
          version: 1,
          content,
          edit_prompt: editPrompt || null,
          changes: changes || null,
          parent_message_id: parentMessageId || null
        });

      if (versionError) {
        console.error('Error adding first draft version:', versionError);
        return res.status(500).json({ error: 'Failed to save draft version' });
      }

      draft = newDraft;
    }

    // Update thread's updated_at
    await supabase
      .from('chat_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);

    // Return draft with versions
    const { data: draftWithVersions, error: fetchError } = await supabase
      .from('chat_thread_drafts')
      .select(`
        *,
        versions:chat_thread_draft_versions(*)
      `)
      .eq('id', draft.id)
      .single();

    if (fetchError) {
      return res.json({ draft });
    }

    res.json({ draft: draftWithVersions });
  } catch (err) {
    console.error('Error in saveDraft:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// =====================================================
// Get draft with all versions
// =====================================================
async function getDraft(req, res) {
  try {
    const { draftId } = req.params;

    const { data: draft, error } = await supabase
      .from('chat_thread_drafts')
      .select(`
        *,
        versions:chat_thread_draft_versions(*)
      `)
      .eq('id', draftId)
      .single();

    if (error || !draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    res.json({ draft });
  } catch (err) {
    console.error('Error in getDraft:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// =====================================================
// Delete a draft (cascade deletes versions)
// =====================================================
async function deleteDraft(req, res) {
  try {
    const { draftId } = req.params;

    const { error } = await supabase
      .from('chat_thread_drafts')
      .delete()
      .eq('id', draftId);

    if (error) {
      console.error('Error deleting draft:', error);
      return res.status(500).json({ error: 'Failed to delete draft' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error in deleteDraft:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// =====================================================
// Update draft version content in-place (overwrite)
// =====================================================
async function updateDraftVersion(req, res) {
  try {
    const { draftId } = req.params;
    const { content, version } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    // Get the draft to find the current version if not specified
    const { data: draft, error: draftError } = await supabase
      .from('chat_thread_drafts')
      .select('id, current_version, thread_id')
      .eq('id', draftId)
      .single();

    if (draftError || !draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    const targetVersion = version || draft.current_version;

    // Update the version content in-place
    const { data: updatedVersion, error: updateError } = await supabase
      .from('chat_thread_draft_versions')
      .update({ content })
      .eq('draft_id', draftId)
      .eq('version', targetVersion)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating draft version:', updateError);
      return res.status(500).json({ error: 'Failed to update draft version' });
    }

    // Update thread's updated_at
    await supabase
      .from('chat_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', draft.thread_id);

    // Return updated draft with all versions
    const { data: draftWithVersions, error: fetchError } = await supabase
      .from('chat_thread_drafts')
      .select(`
        *,
        versions:chat_thread_draft_versions(*)
      `)
      .eq('id', draftId)
      .single();

    if (fetchError) {
      return res.json({ draft: { ...draft, updatedVersion } });
    }

    res.json({ draft: draftWithVersions });
  } catch (err) {
    console.error('Error in updateDraftVersion:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// =====================================================
// Update draft version's parent message ID
// Called after AI message is persisted to DB
// =====================================================
async function updateDraftVersionParentMessage(req, res) {
  try {
    const { draftId } = req.params;
    const { version, parentMessageId } = req.body;

    if (!parentMessageId) {
      return res.status(400).json({ error: 'parentMessageId is required' });
    }

    // Get the draft to find the current version if not specified
    const { data: draft, error: draftError } = await supabase
      .from('chat_thread_drafts')
      .select('id, current_version')
      .eq('id', draftId)
      .single();

    if (draftError || !draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    const targetVersion = version || draft.current_version;

    // Update the version's parent_message_id
    const { error: updateError } = await supabase
      .from('chat_thread_draft_versions')
      .update({ parent_message_id: parentMessageId })
      .eq('draft_id', draftId)
      .eq('version', targetVersion);

    if (updateError) {
      console.error('Error updating draft version parent message:', updateError);
      return res.status(500).json({ error: 'Failed to update draft version' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error in updateDraftVersionParentMessage:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  listThreads,
  createThread,
  getThread,
  updateThread,
  deleteThread,
  addMessage,
  saveDraft,
  getDraft,
  deleteDraft,
  updateDraftVersion,
  updateDraftVersionParentMessage
};
