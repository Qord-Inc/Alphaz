const { Webhook } = require('@clerk/clerk-sdk-node');
const supabase = require('../config/supabase');

// Handle Clerk webhook events
async function handleClerkWebhook(req, res) {
  try {
    // Get the webhook secret from environment
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('CLERK_WEBHOOK_SECRET not configured');
    }

    // Verify the webhook signature
    const payload = req.body;
    const headers = req.headers;
    
    let evt;
    try {
      evt = new Webhook(webhookSecret).verify(payload, headers);
    } catch (err) {
      console.error('Webhook verification failed:', err);
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    // Handle different event types
    switch (evt.type) {
      case 'user.created':
        await handleUserCreated(evt.data);
        break;
      case 'user.updated':
        await handleUserUpdated(evt.data);
        break;
      case 'user.deleted':
        await handleUserDeleted(evt.data);
        break;
      default:
        console.log(`Unhandled webhook event: ${evt.type}`);
    }

    res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ 
      error: 'Webhook processing failed',
      details: error.message 
    });
  }
}

// Handle user.created event
async function handleUserCreated(userData) {
  try {
    const { id, email_addresses, first_name, last_name, oauth_providers } = userData;
    
    // Get primary email
    const primaryEmail = email_addresses.find(e => e.id === userData.primary_email_address_id);
    if (!primaryEmail) {
      console.error('No primary email found for user:', id);
      return;
    }

    // Determine auth method
    const isGoogleAuth = oauth_providers?.some(p => p.strategy === 'oauth_google');
    const authMethod = isGoogleAuth ? 'gmail' : 'email';
    
    // Get Google ID if available
    const googleProvider = oauth_providers?.find(p => p.strategy === 'oauth_google');
    const googleId = googleProvider?.provider_user_info?.user_id;

    // Create user record
    const userRecord = {
      clerk_user_id: id,
      email: primaryEmail.email_address.toLowerCase(),
      name: `${first_name || ''} ${last_name || ''}`.trim() || primaryEmail.email_address.split('@')[0],
      auth_method: authMethod,
      google_id: googleId || null,
      subscription_status: 'trial',
      linkedin_connected: false,
      trial_start_date: new Date().toISOString(),
      trial_end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    };

    const { data, error } = await supabase
      .from('users')
      .insert(userRecord)
      .select()
      .single();

    if (error) {
      console.error('Error creating user from webhook:', error);
    } else {
      console.log('User created from webhook:', data.id);
    }

  } catch (error) {
    console.error('Error in handleUserCreated:', error);
  }
}

// Handle user.updated event
async function handleUserUpdated(userData) {
  try {
    const { id, email_addresses, first_name, last_name } = userData;
    
    // Get primary email
    const primaryEmail = email_addresses.find(e => e.id === userData.primary_email_address_id);
    
    const updates = {
      name: `${first_name || ''} ${last_name || ''}`.trim(),
      email: primaryEmail?.email_address.toLowerCase(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('clerk_user_id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating user from webhook:', error);
    } else {
      console.log('User updated from webhook:', data.id);
    }

  } catch (error) {
    console.error('Error in handleUserUpdated:', error);
  }
}

// Handle user.deleted event
async function handleUserDeleted(userData) {
  try {
    const { id } = userData;

    const { data, error } = await supabase
      .from('users')
      .delete()
      .eq('clerk_user_id', id)
      .select()
      .single();

    if (error) {
      console.error('Error deleting user from webhook:', error);
    } else {
      console.log('User deleted from webhook:', data.id);
    }

  } catch (error) {
    console.error('Error in handleUserDeleted:', error);
  }
}

module.exports = {
  handleClerkWebhook
};