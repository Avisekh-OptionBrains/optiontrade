const express = require('express');
const router = express.Router();
const IIFLUser = require('../models/IIFLUser');
const EpicriseSubscription = require('../models/StrategySubscriptions/EpicriseSubscription');
const OptionTradeSubscription = require('../models/StrategySubscriptions/OptionTradeSubscription');
const BankNiftySubscription = require('../models/StrategySubscriptions/BankNiftySubscription');

// ============================================================
// IIFL USER ROUTES
// ============================================================

// Get all IIFL users
router.get('/users/iifl', async (req, res) => {
  try {
    const users = await IIFLUser.find().select('-password -appSecret -totpSecret');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get single IIFL user
router.get('/users/iifl/:userID', async (req, res) => {
  try {
    const user = await IIFLUser.findOne({ userID: req.params.userID })
      .select('-password -appSecret -totpSecret');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Add new IIFL user
router.post('/iifl/add-user', async (req, res) => {
  try {
    let { clientName, userID, email, phoneNumber, password, appKey, appSecret, totpSecret } = req.body;

    // Trim all credential fields to remove spaces
    userID = userID?.trim();
    password = password?.trim();
    appKey = appKey?.trim();
    appSecret = appSecret?.trim();
    totpSecret = totpSecret?.trim();
    email = email?.trim();
    phoneNumber = phoneNumber?.trim();

    // Validate required fields
    if (!clientName || !userID || !email || !phoneNumber || !password || !appKey || !appSecret || !totpSecret) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate no spaces in critical fields
    if (userID.includes(' ') || appKey.includes(' ') || appSecret.includes(' ') || totpSecret.includes(' ')) {
      return res.status(400).json({ error: 'Credentials cannot contain spaces' });
    }

    // Check if user already exists
    const existingUser = await IIFLUser.findOne({ userID });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this User ID' });
    }

    // Create new user
    const newUser = new IIFLUser({
      clientName,
      userID,
      email,
      phoneNumber,
      password,
      appKey,
      appSecret,
      totpSecret,
      state: 'live',
      loginStatus: 'pending'
    });

    await newUser.save();

    console.log(`✅ New IIFL user added: ${clientName} (${userID})`);

    res.json({
      success: true,
      message: 'User added successfully',
      userID: newUser.userID
    });

  } catch (error) {
    console.error('Error adding user:', error);
    res.status(500).json({ error: 'Failed to add user: ' + error.message });
  }
});

// Test IIFL login credentials
router.post('/iifl/test-login', async (req, res) => {
  try {
    let { userID, password, appKey, appSecret, totpSecret } = req.body;

    // Trim all fields
    userID = userID?.trim();
    password = password?.trim();
    appKey = appKey?.trim();
    appSecret = appSecret?.trim();
    totpSecret = totpSecret?.trim();

    // Validate required fields
    if (!userID || !password || !appKey || !appSecret || !totpSecret) {
      return res.status(400).json({
        success: false,
        error: 'All credentials are required for testing'
      });
    }

    console.log(`🧪 Testing IIFL login for User ID: ${userID}`);

    // Use the login utility
    const { loginWithCredentials } = require("../Strategies/Epicrise/Brokers/IIFL/loginUtils");

    const userCredentials = {
      userID,
      password,
      appKey,
      appSecret,
      totpSecret
    };

    const loginResult = await loginWithCredentials(userCredentials);

    if (loginResult.success && loginResult.token) {
      console.log(`✅ Test login successful for ${userID}`);
      res.json({
        success: true,
        message: 'Login test successful',
        token: loginResult.token
      });
    } else {
      console.log(`❌ Test login failed for ${userID}: ${loginResult.error}`);
      res.status(401).json({
        success: false,
        error: loginResult.error || 'Login failed'
      });
    }

  } catch (error) {
    console.error('Error testing login:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Login test failed'
    });
  }
});

// Update user state
router.put('/users/iifl/:userID/state', async (req, res) => {
  try {
    const { state } = req.body;
    
    const user = await IIFLUser.findOneAndUpdate(
      { userID: req.params.userID },
      { state },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error updating user state:', error);
    res.status(500).json({ error: 'Failed to update user state' });
  }
});

// Delete user
router.delete('/users/iifl/:userID', async (req, res) => {
  try {
    const userID = req.params.userID;
    
    // Delete user
    const user = await IIFLUser.findOneAndDelete({ userID });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Delete all subscriptions
    await Promise.all([
      EpicriseSubscription.deleteMany({ userID }),
      OptionTradeSubscription.deleteMany({ userID }),
      BankNiftySubscription.deleteMany({ userID })
    ]);
    
    res.json({ success: true, message: 'User and all subscriptions deleted' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ============================================================
// SUBSCRIPTION ROUTES
// ============================================================

// Get subscription model based on strategy
function getSubscriptionModel(strategy) {
  switch(strategy.toLowerCase()) {
    case 'epicrise':
      return EpicriseSubscription;
    case 'optiontrade':
      return OptionTradeSubscription;
    case 'banknifty':
      return BankNiftySubscription;
    default:
      return null;
  }
}

// Get all subscriptions for a strategy
router.get('/subscriptions/:strategy', async (req, res) => {
  try {
    const Model = getSubscriptionModel(req.params.strategy);

    if (!Model) {
      return res.status(400).json({ error: 'Invalid strategy' });
    }

    const subscriptions = await Model.find();

    // Populate with user details and fix missing lotSize
    const enrichedSubscriptions = await Promise.all(
      subscriptions.map(async (sub) => {
        const user = await IIFLUser.findOne({ userID: sub.userID }).select('clientName email');
        const subObj = sub.toObject();

        // Fix missing lotSize for old subscriptions (set default to 1)
        if (req.params.strategy !== 'epicrise' && !subObj.lotSize) {
          subObj.lotSize = 1;
          // Update in database
          await Model.updateOne({ userID: sub.userID }, { lotSize: 1 });
        }

        return {
          ...subObj,
          clientName: user?.clientName || sub.userID
        };
      })
    );

    res.json(enrichedSubscriptions);
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// Get single subscription
router.get('/subscriptions/:strategy/:userID', async (req, res) => {
  try {
    const Model = getSubscriptionModel(req.params.strategy);

    if (!Model) {
      return res.status(400).json({ error: 'Invalid strategy' });
    }

    const subscription = await Model.findOne({ userID: req.params.userID });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json(subscription);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Create subscription
router.post('/subscriptions/:strategy', async (req, res) => {
  try {
    const Model = getSubscriptionModel(req.params.strategy);

    if (!Model) {
      return res.status(400).json({ error: 'Invalid strategy' });
    }

    const { userID } = req.body;

    // Check if user exists
    const user = await IIFLUser.findOne({ userID });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if subscription already exists
    const existing = await Model.findOne({ userID });
    if (existing) {
      return res.status(400).json({ error: 'Subscription already exists' });
    }

    // Create subscription
    const subscription = new Model(req.body);
    await subscription.save();

    res.json({ success: true, subscription });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// Update subscription
router.put('/subscriptions/:strategy/:userID', async (req, res) => {
  try {
    const Model = getSubscriptionModel(req.params.strategy);

    if (!Model) {
      return res.status(400).json({ error: 'Invalid strategy' });
    }

    const subscription = await Model.findOneAndUpdate(
      { userID: req.params.userID },
      req.body,
      { new: true }
    );

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json({ success: true, subscription });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// Delete subscription
router.delete('/subscriptions/:strategy/:userID', async (req, res) => {
  try {
    const Model = getSubscriptionModel(req.params.strategy);

    if (!Model) {
      return res.status(400).json({ error: 'Invalid strategy' });
    }

    const subscription = await Model.findOneAndDelete({ userID: req.params.userID });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json({ success: true, message: 'Subscription deleted' });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    res.status(500).json({ error: 'Failed to delete subscription' });
  }
});

// Get all subscriptions for a user
router.get('/users/:userID/subscriptions', async (req, res) => {
  try {
    const userID = req.params.userID;

    const [epicrise, optiontrade, banknifty] = await Promise.all([
      EpicriseSubscription.findOne({ userID }),
      OptionTradeSubscription.findOne({ userID }),
      BankNiftySubscription.findOne({ userID })
    ]);

    res.json({
      epicrise,
      optiontrade,
      banknifty
    });
  } catch (error) {
    console.error('Error fetching user subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch user subscriptions' });
  }
});

module.exports = router;

