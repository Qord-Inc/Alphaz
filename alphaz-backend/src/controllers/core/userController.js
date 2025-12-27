const supabase = require('../../config/supabase');
const clerk = require('../../config/clerk');

// Create a new user after successful Clerk authentication
async function createUser(req, res) {
  try {
    const { clerkUserId, email, name, googleId, authMethod } = req.body;

    // Validate required fields
    if (!clerkUserId || !email || !name || !authMethod) {
      return res.status(400).json({
        error: 'Missing required fields: clerkUserId, email, name, authMethod'
      });
    }

    // Validate auth method
    if (!['gmail', 'email'].includes(authMethod)) {
      return res.status(400).json({
        error: 'Invalid auth method. Must be "gmail" or "email"'
      });
    }

    // If Gmail auth, googleId is required
    if (authMethod === 'gmail' && !googleId) {
      return res.status(400).json({
        error: 'Google ID is required for Gmail authentication'
      });
    }

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .single();

    if (existingUser) {
      return res.status(200).json({
        message: 'User already exists',
        user: existingUser
      });
    }

    // Create new user
    const userData = {
      clerk_user_id: clerkUserId,
      email: email.toLowerCase(),
      name,
      auth_method: authMethod,
      subscription_status: 'trial',
      linkedin_connected: false,
      trial_start_date: new Date().toISOString(),
      trial_end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 days from now
    };

    // Add googleId if provided
    if (googleId) {
      userData.google_id = googleId;
    }

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating user:', insertError);
      return res.status(500).json({
        error: 'Failed to create user',
        details: insertError.message
      });
    }

    res.status(201).json({
      message: 'User created successfully',
      user: newUser
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}

// Get user by Clerk ID
async function getUserByClerkId(req, res) {
  try {
    const { clerkUserId } = req.params;

    if (!clerkUserId) {
      return res.status(400).json({
        error: 'Clerk user ID is required'
      });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .single();

    if (error || !user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.status(200).json({
      user
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}

// Update user
async function updateUser(req, res) {
  try {
    const { clerkUserId } = req.params;
    const updates = req.body;

    if (!clerkUserId) {
      return res.status(400).json({
        error: 'Clerk user ID is required'
      });
    }

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.clerk_user_id;
    delete updates.created_at;
    delete updates.trial_start_date;

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updates)
      .eq('clerk_user_id', clerkUserId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user:', error);
      return res.status(500).json({
        error: 'Failed to update user',
        details: error.message
      });
    }

    if (!updatedUser) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.status(200).json({
      message: 'User updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}

// Check if user exists
async function checkUserExists(req, res) {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required'
      });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('email')
      .eq('email', email.toLowerCase())
      .single();

    res.status(200).json({
      exists: !!user
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}

module.exports = {
  createUser,
  getUserByClerkId,
  updateUser,
  checkUserExists
};