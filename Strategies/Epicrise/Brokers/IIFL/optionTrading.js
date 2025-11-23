const { processBBTrapSignal } = require('../../../../../optionTradingWithDB.js');

/**
 * Process BB TRAP signal and place option orders
 * This function is called from the IIFL broker handler
 */
async function handleBBTrapSignal(messageText) {
  try {
    console.log('\n🎯 BB TRAP OPTION TRADING HANDLER');
    console.log('='.repeat(60));
    console.log(`Signal: ${messageText}`);
    
    // Check if this is a BB TRAP signal
    if (!messageText.includes('BB TRAP')) {
      console.log('⚠️ Not a BB TRAP signal, skipping option trading');
      return {
        success: false,
        message: 'Not a BB TRAP signal'
      };
    }
    
    // Process the BB TRAP signal
    const result = await processBBTrapSignal(messageText);
    
    if (result.success) {
      console.log('✅ BB TRAP signal processed successfully');
      console.log(`   Orders placed: ${result.orders.length}`);
      console.log(`   Successful: ${result.results.filter(r => r.success).length}`);
      console.log(`   Failed: ${result.results.filter(r => !r.success).length}`);
    } else {
      console.log('❌ BB TRAP signal processing failed:', result.error);
    }
    
    console.log('='.repeat(60));
    
    return result;
    
  } catch (error) {
    console.error('❌ Error in BB TRAP handler:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  handleBBTrapSignal
};

