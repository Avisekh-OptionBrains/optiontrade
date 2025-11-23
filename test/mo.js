app.post("/MotilalOrderPlace", async (req, res) => {
  console.log("INFO: Route accessed - /MotilalOrderPlace");

  try {
    let messageText = req.body;
    console.log(
      "INFO: Received request body:",
      JSON.stringify(messageText, null, 2)
    );

    if (typeof messageText === "object" && messageText.messageText) {
      messageText = messageText.messageText;
    }

    if (!messageText) {
      console.log("ERROR: Message text is required");
      return res.status(400).json({ error: "Message text is required" });
    }

    console.log("INFO: Parsing message text...");
    const parsedData = EangelparseMessageText(messageText);
    console.log(
      "INFO: Parsed message text:",
      JSON.stringify(parsedData, null, 2)
    );

    if (!parsedData) {
      console.log("ERROR: Invalid message format");
      return res.status(400).json({ error: "Invalid message format" });
    }

    const { symbol, price, transactionType } = parsedData;
    console.log("INFO: Extracted data -", { symbol, price, transactionType });

    console.log("INFO: Fetching credentials...");
    const credentials = await getCredentials();
    const { macAddress, localIp, publicIp } = credentials;
    console.log("INFO: Credentials fetched:", {
      macAddress,
      localIp,
      publicIp,
    });

    if (!macAddress || !localIp || !publicIp) {
      console.log("ERROR: Missing required credentials");
      return res.status(400).json({ error: "Missing required credentials" });
    }

    console.log(`INFO: Searching for symbol "${symbol}" in database...`);
    const document = await findSymbolInDatabase(symbol);
    console.log("INFO: Symbol lookup result:", document);

    if (!document) {
      console.log("ERROR: Symbol not found in database");
      return res.status(404).json({ error: "Symbol not found in database" });
    }

    const token = Number(document.token);
    console.log("INFO: Parsed token:", token);

    if (isNaN(token)) {
      console.log("ERROR: Invalid token format");
      return res.status(400).json({ error: "Invalid token format" });
    }

    console.log("INFO: Fetching clients...");
    const clients = await MOUser.find();
    console.log("INFO: Clients fetched:", clients.length, "clients found.");

    if (!clients || clients.length === 0) {
      console.log("ERROR: No clients found");
      return res.status(404).json({ error: "No clients found" });
    }

    const ordersPromises = clients.map(async (client, index) => {
      console.log(
        `INFO: Processing order for client ${index + 1}/${clients.length}: ${
          client._id
        }`
      );
      const clientCapital = client.capital;
      const quantity = Math.floor(clientCapital / price);

      if (quantity <= 0) {
        console.log(`ERROR: Invalid quantity for client ${client._id}`);
        return {
          status: "ERROR",
          message: `Invalid quantity for client ${client._id}`,
        };
      }

      const headers = {
        Accept: "application/json",
        "User-Agent": "MOSL/V.1.1.0",
        Authorization: client.authToken,
        ApiKey: client.apiKey,
        ClientLocalIp: localIp,
        ClientPublicIp: publicIp,
        MacAddress: macAddress,
        SourceId: "WEB",
        vendorinfo: client.userId,
        osname: "Windows-10",
        osversion: "10.0.19041",
        devicemodel: "AHV",
        manufacturer: "DELL",
        productname: "Dellserver",
        productversion: "m3-48vcpu-384gb-intel",
        installedappid: "AppID",
        browsername: "Chrome",
        browserversion: "105.0",
      };

      const body = {
        exchange: "NSE",
        symboltoken: token,
        buyorsell: transactionType === "BUY" ? "BUY" : "SELL",
        ordertype: "LIMIT",
        producttype: "VALUEPLUS",
        orderduration: "DAY",
        price: price,
        quantityinlot: quantity,
        amoorder: "N",
      };

      try {
        console.log("INFO: Placing primary order:", body);
        const response = await axios.post(
          "https://openapi.motilaloswal.com/rest/trans/v1/placeorder",
          body,
          { headers }
        );

        console.log(
          `SUCCESS: Primary order response for client ${client._id}:`,
          response.data
        );

        // Helper function to calculate stop-loss and trigger prices
        function roundToTwoDecimalsEndingInZero(value) {
          return (Math.round(value * 10) / 10).toFixed(1) + "0";
        }

        // Create stop-loss and trigger price based on your logic
        const { stopLossOrderPrice, triggerPrice } = createStopLossOrderData(
          document,
          transactionType,
          price,
          price * 0.97, // Initial stop loss price (before rounding)
          quantity
        );

        setTimeout(async () => {
          const stopLossBody = {
            exchange: "NSE",
            symboltoken: token,
            buyorsell: transactionType === "BUY" ? "SELL" : "BUY",
            ordertype: "STOPLOSS",
            producttype: "VALUEPLUS",
            orderduration: "DAY",
            price: Number(roundToTwoDecimalsEndingInZero(stopLossOrderPrice)), // Use the calculated stop loss price
            triggerprice: Number(roundToTwoDecimalsEndingInZero(triggerPrice)), // Round trigger price to two decimal places
            quantityinlot: quantity,
            amoorder: "N",
          };

          try {
            console.log("INFO: Placing stop-loss order:", stopLossBody);
            const stopLossResponse = await axios.post(
              "https://openapi.motilaloswal.com/rest/trans/v1/placeorder",
              stopLossBody,
              { headers }
            );

            console.log(
              `SUCCESS: Stop-loss order response for client ${client._id}:`,
              stopLossResponse.data
            );
          } catch (stopLossError) {
            console.error(
              `ERROR: Stop-loss order failed for client ${client._id}:`,
              stopLossError.message
            );
          }
        }, 5000);

        return response.data;
      } catch (error) {
        console.error(
          `ERROR: Primary order failed for client ${client._id}:`,
          error.message
        );
        throw error;
      }
    });

    const ordersResults = await Promise.allSettled(ordersPromises);
    console.log("INFO: Orders processing results:", ordersResults);

    console.log("INFO: Sending message to Telegram...");
    const telegramMessageResult = await sendMessageToTelegram(
      CONFIG.FLASH45.TELEGRAM_BOT_TOKEN,
      CONFIG.FLASH45.CHANNEL_ID,
      messageText
    );

    console.log("SUCCESS: Telegram message sent:", telegramMessageResult);

    res.json({
      message: "Orders processed successfully",
      ordersResults,
      telegramMessageResult,
    });
  } catch (error) {
    console.error("ERROR: Request processing failed:", error.message);
    res.status(500).json({
      error: "An error occurred while processing the request",
      details: error.message,
    });
  }
});
