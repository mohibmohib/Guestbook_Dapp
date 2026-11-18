// ==========================================================================
// Blockchain Guestbook — Smart Contract & Web3 Integration
// Course: Blockchain Security (CY414) — Assignment #02
// ==========================================================================

// --- Configuration ---
const CONTRACT_ADDRESS = "0xdC7f7503D1754d633F9875117aC9E1E67db2F447";
const SEPOLIA_CHAIN_ID_DEC = 11155111;
const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";
const PUBLIC_SEPOLIA_RPCS = [
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://rpc.sepolia.org",
  "https://sepolia.gateway.tenderly.co"
];

// Contract ABI matching Guestbook.sol
const CONTRACT_ABI = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "id", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "sender", "type": "address" },
      { "indexed": false, "internalType": "string", "name": "name", "type": "string" },
      { "indexed": false, "internalType": "string", "name": "messageText", "type": "string" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "NewMessage",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "getAllMessages",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "id", "type": "uint256" },
          { "internalType": "address", "name": "sender", "type": "address" },
          { "internalType": "string", "name": "name", "type": "string" },
          { "internalType": "string", "name": "messageText", "type": "string" },
          { "internalType": "uint256", "name": "timestamp", "type": "uint256" }
        ],
        "internalType": "struct Guestbook.Message[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getMessageCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "_name", "type": "string" },
      { "internalType": "string", "name": "_messageText", "type": "string" }
    ],
    "name": "submitMessage",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalMessages",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

// --- Global Variables ---
let web3;
let contract;
let accounts = null;
let currentChainId = null;

// ==========================================================================
// Initialization
// ==========================================================================

window.addEventListener('load', async () => {
  setupEventListeners();

  // Check if MetaMask is installed
  if (typeof window.ethereum !== 'undefined') {
    web3 = new Web3(window.ethereum);
    console.log("Web3 initialized with window.ethereum (MetaMask)");

    try {
      currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
      checkNetwork(currentChainId);

      // Listen for network changes
      window.ethereum.on('chainChanged', (chainId) => {
        currentChainId = chainId;
        checkNetwork(chainId);
        window.location.reload();
      });

      // Listen for account changes
      window.ethereum.on('accountsChanged', (newAccounts) => {
        if (newAccounts.length === 0) {
          onWalletDisconnected();
        } else {
          accounts = newAccounts;
          onWalletConnected();
        }
      });
    } catch (err) {
      console.warn("Could not retrieve chainId:", err);
    }

    // Check if already connected (e.g. page refresh)
    await checkConnection();

    // Load messages from blockchain via .call()
    await loadBlockchainData();

  } else {
    // Read-only fallback provider when MetaMask is not installed
    console.log("MetaMask is not installed. Initializing read-only provider for Sepolia...");
    initReadOnlyWeb3();
    await loadBlockchainData();

    const connectBtn = document.getElementById("connectWalletBtn");
    if (connectBtn) {
      connectBtn.querySelector('.wallet-btn-text').innerText = "Install MetaMask";
    }
    showNotification("MetaMask Not Installed", "Please install MetaMask to submit messages. You can view existing messages in read-only mode.", "info");
  }
});

// Setup public RPC provider for read operations when MetaMask is not present
function initReadOnlyWeb3() {
  for (const rpc of PUBLIC_SEPOLIA_RPCS) {
    try {
      web3 = new Web3(new Web3.providers.HttpProvider(rpc));
      console.log("Read-only Web3 connected using:", rpc);
      break;
    } catch (e) {
      console.warn("RPC provider failed:", rpc, e);
    }
  }
}

// ==========================================================================
// Network Checking & Switching
// ==========================================================================

function checkNetwork(chainId) {
  const isSepolia = (chainId === SEPOLIA_CHAIN_ID_HEX || parseInt(chainId, 16) === SEPOLIA_CHAIN_ID_DEC);
  const networkBadge = document.getElementById('networkBadge');
  const networkText = document.getElementById('networkText');
  const wrongNetworkBanner = document.getElementById('wrongNetworkBanner');

  if (networkBadge && networkText) {
    if (isSepolia) {
      networkText.innerText = "Sepolia Testnet";
      networkBadge.style.color = "var(--accent-primary)";
      networkBadge.style.borderColor = "rgba(210, 255, 0, 0.35)";
    } else {
      networkText.innerText = "Wrong Network";
      networkBadge.style.color = "var(--alert-danger)";
      networkBadge.style.borderColor = "rgba(255, 59, 48, 0.4)";
    }
  }

  if (wrongNetworkBanner) {
    wrongNetworkBanner.style.display = (accounts && !isSepolia) ? 'flex' : 'none';
  }
}

async function switchToSepolia() {
  if (!window.ethereum) return;
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }]
    });
    showNotification("Network Switched", "Successfully connected to Ethereum Sepolia Testnet", "success");
  } catch (switchError) {
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: SEPOLIA_CHAIN_ID_HEX,
            chainName: 'Sepolia Testnet',
            nativeCurrency: { name: 'Sepolia ETH', symbol: 'SEP', decimals: 18 },
            rpcUrls: ['https://rpc.sepolia.org'],
            blockExplorerUrls: ['https://sepolia.etherscan.io']
          }]
        });
      } catch (addError) {
        showNotification("Network Error", "Could not add Sepolia network to MetaMask.", "error");
      }
    } else {
      showNotification("Network Error", "Failed to switch to Sepolia network.", "error");
    }
  }
}

// ==========================================================================
// MetaMask Wallet Connection
// ==========================================================================

const connectWalletBtn = document.getElementById('connectWalletBtn');

if (connectWalletBtn) {
  connectWalletBtn.addEventListener('click', async () => {
    if (typeof window.ethereum === 'undefined') {
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    if (!accounts) {
      try {
        // Request account access
        accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        onWalletConnected();
        showNotification("Wallet Connected", `Connected as ${accounts[0].substring(0, 6)}...${accounts[0].substring(38)}`, "success");
      } catch (error) {
        console.error("User denied account access", error);
        showNotification("Connection Rejected", "MetaMask connection was rejected or cancelled.", "error");
      }
    } else {
      console.log("Wallet already connected:", accounts[0]);
    }
  });
}

async function checkConnection() {
  try {
    const ethAccounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (ethAccounts.length > 0) {
      accounts = ethAccounts;
      onWalletConnected();
    }
  } catch (error) {
    console.error("Error checking connection:", error);
  }
}

function onWalletConnected() {
  if (!accounts || accounts.length === 0) return;
  const userAddress = accounts[0];

  const btnText = connectWalletBtn.querySelector('.wallet-btn-text');
  if (btnText) {
    btnText.innerText = `Connected: ${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
  }
  connectWalletBtn.classList.add('is-connected');

  // Enable submit button now that wallet is connected
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.disabled = false;
  }

  // Update wallet status strip (UX enhancement)
  const stripDot = document.getElementById('stripDot');
  const stripStatusText = document.getElementById('stripStatusText');
  const stripAccountBadge = document.getElementById('stripAccountBadge');
  const stripAccountAddress = document.getElementById('stripAccountAddress');

  if (stripDot) stripDot.classList.add('is-active');
  if (stripStatusText) stripStatusText.innerText = "Wallet Connected & Authorized";
  if (stripAccountBadge && stripAccountAddress) {
    stripAccountAddress.innerText = `${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
    stripAccountBadge.style.display = 'block';
  }

  // Update wallet hint text
  const walletHintText = document.getElementById('walletHintText');
  if (walletHintText) {
    walletHintText.innerHTML = `Ready to submit. Your message will be permanently inscribed on Ethereum Sepolia.`;
  }

  // Check network state
  if (currentChainId) {
    checkNetwork(currentChainId);
  }

  // Initialize contract instance with signer account
  contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS, { from: userAddress });
}

function onWalletDisconnected() {
  accounts = null;
  contract = null;

  const btnText = connectWalletBtn.querySelector('.wallet-btn-text');
  if (btnText) {
    btnText.innerText = "Connect Wallet";
  }
  connectWalletBtn.classList.remove('is-connected');

  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
  }

  const stripDot = document.getElementById('stripDot');
  const stripStatusText = document.getElementById('stripStatusText');
  const stripAccountBadge = document.getElementById('stripAccountBadge');

  if (stripDot) stripDot.classList.remove('is-active');
  if (stripStatusText) stripStatusText.innerText = "MetaMask Not Connected";
  if (stripAccountBadge) stripAccountBadge.style.display = 'none';

  const walletHintText = document.getElementById('walletHintText');
  if (walletHintText) {
    walletHintText.innerText = "Connect your MetaMask wallet in the top right to enable submission.";
  }
}

// ==========================================================================
// Blockchain Interaction (Read Operations via .call())
// ==========================================================================

async function loadBlockchainData() {
  const loadingEl = document.getElementById('loadingMessages');
  const refreshBtn = document.getElementById('refreshBtn');
  const refreshBtnLabel = document.getElementById('refreshBtnLabel');

  if (refreshBtn) refreshBtn.classList.add('is-spinning');
  if (refreshBtnLabel) refreshBtnLabel.innerText = "Syncing...";

  try {
    if (!web3) {
      initReadOnlyWeb3();
    }

    // Initialize read-only contract instance
    const readOnlyContract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);

    // 1. Retrieve total message count using .call() (Required)
    let messageCount = 0;
    try {
      messageCount = await readOnlyContract.methods.totalMessages().call();
      const countDisplay = document.getElementById('totalMessagesDisplay');
      if (countDisplay) {
        countDisplay.innerText = messageCount.toString();
      }
    } catch (countErr) {
      console.warn("Could not fetch totalMessages count:", countErr);
    }

    // 2. Retrieve all messages using .call() (Required)
    let messages = [];
    try {
      messages = await readOnlyContract.methods.getAllMessages().call();
    } catch (msgErr) {
      console.warn("Could not fetch getAllMessages:", msgErr);
    }

    // Render messages (Smart contract's getAllMessages returns latest first)
    renderMessages(messages);

    if (loadingEl) loadingEl.style.display = 'none';

  } catch (error) {
    console.error("Error loading blockchain data:", error);
    if (loadingEl) {
      loadingEl.innerHTML = `
        <p style="color:var(--alert-danger);">Error loading messages. Make sure you are on Ethereum Sepolia and contract is deployed.</p>
      `;
    }
  } finally {
    if (refreshBtn) {
      setTimeout(() => {
        refreshBtn.classList.remove('is-spinning');
        if (refreshBtnLabel) refreshBtnLabel.innerText = "Refresh Messages";
      }, 500);
    }
  }
}

// ==========================================================================
// Message Submission Form (Write Operation via .send())
// ==========================================================================

const guestbookForm = document.getElementById('guestbookForm');
const visitorNameInput = document.getElementById('visitorName');
const visitorMessageInput = document.getElementById('visitorMessage');
const currentCharsDisplay = document.getElementById('currentChars');
const charBarFill = document.getElementById('charBarFill');

// Character Counter (Restricted to maximum 200 characters)
if (visitorMessageInput) {
  visitorMessageInput.addEventListener('input', () => {
    const currentLength = visitorMessageInput.value.length;
    if (currentCharsDisplay) currentCharsDisplay.innerText = currentLength;

    if (charBarFill) {
      const percentage = Math.min((currentLength / 200) * 100, 100);
      charBarFill.style.width = `${percentage}%`;

      if (currentLength >= 200) {
        charBarFill.style.backgroundColor = 'var(--alert-danger)';
        if (currentCharsDisplay) currentCharsDisplay.style.color = 'var(--alert-danger)';
      } else if (currentLength > 160) {
        charBarFill.style.backgroundColor = 'var(--alert-warning)';
        if (currentCharsDisplay) currentCharsDisplay.style.color = 'var(--alert-warning)';
      } else {
        charBarFill.style.backgroundColor = 'var(--accent-primary)';
        if (currentCharsDisplay) currentCharsDisplay.style.color = '';
      }
    }
  });
}

// Submit Form Handler
if (guestbookForm) {
  guestbookForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    // 1. MetaMask connection check
    if (!contract || !accounts || !accounts[0]) {
      showNotification("Wallet Required", "Please connect your MetaMask wallet first.", "error");
      return;
    }

    const name = visitorNameInput.value.trim();
    const message = visitorMessageInput.value.trim();

    // 2. Validate that both fields are filled (Required)
    if (name === '' || message === '') {
      showNotification("Validation Error", "Both Visitor Name and Message are required.", "error");
      return;
    }

    // 3. Restrict messages to a maximum of 200 characters (Required)
    if (message.length > 200) {
      showNotification("Validation Error", "Message must be 200 characters or less.", "error");
      return;
    }

    const submitBtn = document.getElementById('submitBtn');
    const submitBtnText = document.getElementById('submitBtnText');
    const submitSpinner = document.getElementById('submitSpinner');
    const txPendingBanner = document.getElementById('txPendingBanner');
    const pendingStatusTitle = document.getElementById('pendingStatusTitle');
    const pendingStatusDesc = document.getElementById('pendingStatusDesc');
    const originalBtnText = submitBtnText ? submitBtnText.innerText : "Submit Message to Blockchain";

    try {
      submitBtn.disabled = true;
      if (submitSpinner) submitSpinner.style.display = 'inline-block';
      if (submitBtnText) submitBtnText.innerText = "Awaiting MetaMask...";

      // Show in-flight pending status banner (UX enhancement)
      if (txPendingBanner) {
        txPendingBanner.style.display = 'flex';
        if (pendingStatusTitle) pendingStatusTitle.innerText = "Waiting for MetaMask Confirmation...";
        if (pendingStatusDesc) pendingStatusDesc.innerText = "Please approve the transaction prompt in your MetaMask wallet extension.";
      }

      showNotification("MetaMask Confirmation", "Please confirm the transaction in your MetaMask wallet extension.", "info");

      // 4. Submit message through the smart contract using .send() (Required: write operation)
      const txPromise = contract.methods.submitMessage(name, message).send({ from: accounts[0] });

      // Update UX as soon as transaction is broadcasted to network
      txPromise.on('transactionHash', (hash) => {
        if (pendingStatusTitle) pendingStatusTitle.innerText = "Mining on Sepolia Blockchain...";
        if (pendingStatusDesc) pendingStatusDesc.innerText = `Tx hash: ${hash.substring(0, 14)}... Waiting for block validation.`;
        if (submitBtnText) submitBtnText.innerText = "Mining block...";
      });

      const receipt = await txPromise;

      console.log("Transaction successful:", receipt);

      // 5. Display appropriate success notification (Required)
      showNotification("Success!", "Message successfully added to the Ethereum blockchain!", "success");

      // 6. Display the transaction hash & link to view on Sepolia Etherscan (Required)
      displayTransactionResult(receipt.transactionHash);

      // 7. Reset Form & Character counter
      guestbookForm.reset();
      if (currentCharsDisplay) currentCharsDisplay.innerText = "0";
      if (charBarFill) charBarFill.style.width = "0%";

      // 8. Automatically refresh the message list after submission (Required)
      await loadBlockchainData();

    } catch (error) {
      console.error("Submission failed:", error);
      const isRejected = error.code === 4001 || (error.message && error.message.includes("User denied"));
      if (isRejected) {
        showNotification("Transaction Cancelled", "Transaction was rejected in MetaMask.", "error");
      } else {
        showNotification("Transaction Failed", "Transaction failed or was rejected. Check console for details.", "error");
      }
    } finally {
      submitBtn.disabled = false;
      if (submitSpinner) submitSpinner.style.display = 'none';
      if (submitBtnText) submitBtnText.innerText = originalBtnText;
      if (txPendingBanner) txPendingBanner.style.display = 'none';
    }
  });
}

// Helper to copy text to clipboard with notification feedback
window.copyToClipboard = function(text, successMsg = "Copied to clipboard!") {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showNotification("Copied", successMsg, "success");
    }).catch(() => {
      fallbackCopy(text, successMsg);
    });
  } else {
    fallbackCopy(text, successMsg);
  }
};

function fallbackCopy(text, successMsg) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  showNotification("Copied", successMsg, "success");
}

// Display Transaction Information (Required)
function displayTransactionResult(txHash) {
  const resultBox = document.getElementById('transactionResult');
  const txHashDisplay = document.getElementById('txHashDisplay');
  const txEtherscanLink = document.getElementById('txEtherscanLink');
  const copyTxBtn = document.getElementById('copyTxBtn');

  if (resultBox && txHashDisplay && txEtherscanLink && txHash) {
    txHashDisplay.innerText = txHash;
    txHashDisplay.onclick = () => window.copyToClipboard(txHash, "Transaction hash copied!");
    txHashDisplay.title = "Click to copy transaction hash";
    txEtherscanLink.href = `https://sepolia.etherscan.io/tx/${txHash}`;

    if (copyTxBtn) {
      copyTxBtn.onclick = () => {
        window.copyToClipboard(txHash, "Transaction hash copied!");
        copyTxBtn.innerText = "✓ Copied";
        setTimeout(() => copyTxBtn.innerText = "Copy", 2000);
      };
    }

    resultBox.style.display = 'block';

    // Scroll smoothly to transaction result
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// ==========================================================================
// Message Display Rendering
// ==========================================================================

function renderMessages(messages) {
  const container = document.getElementById('messagesContainer');
  const emptyState = document.getElementById('noMessagesNotice');
  if (!container) return;

  container.innerHTML = '';

  if (!messages || messages.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  // Smart contract getAllMessages() returns latest messages first.
  messages.forEach((msg) => {
    const { sender, name, messageText, timestamp } = msg;

    // Convert Unix timestamp to readable date and time
    const date = new Date(Number(timestamp) * 1000);
    const dateString = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    const relativeTime = getRelativeTime(Number(timestamp));

    // Format Sender Wallet Address (e.g. 0x1234...abcd)
    const truncatedAddress = sender ? `${sender.substring(0, 6)}...${sender.substring(38)}` : '0x000...000';

    // Create Message Card Element
    const messageCard = document.createElement('div');
    messageCard.className = 'message-card';

    messageCard.innerHTML = `
      <div class="card-header">
        <div class="author-meta">
          <span class="visitor-name">${escapeHtml(name)}</span>
          <span class="wallet-address" onclick="copyToClipboard('${sender}', 'Wallet address copied!')" title="Click to copy full address: ${sender}" style="cursor:pointer;">${truncatedAddress} <span style="opacity:0.6;font-size:10px;">⧉</span></span>
        </div>
        <span class="timestamp" title="${dateString}">${relativeTime}</span>
      </div>
      <div class="card-body">
        <p class="message-text">${escapeHtml(messageText)}</p>
      </div>
      <div class="card-footer">
        <a href="https://sepolia.etherscan.io/address/${sender}" target="_blank" rel="noopener noreferrer" class="etherscan-sender-link">
          <span>View Sender on Sepolia Etherscan</span>
          <span>↗</span>
        </a>
      </div>
    `;

    container.appendChild(messageCard);
  });
}

function getRelativeTime(timestampSec) {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestampSec;

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

  const d = new Date(timestampSec * 1000);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ==========================================================================
// Notifications & UI Setup
// ==========================================================================

function setupEventListeners() {
  const switchBtn = document.getElementById('switchNetworkBtn');
  if (switchBtn) {
    switchBtn.addEventListener('click', switchToSepolia);
  }

  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      await loadBlockchainData();
      showNotification("Refreshed", "Message list synchronized with blockchain.", "info");
    });
  }
}

// Success and Error Notifications (Required)
function showNotification(title, message, type = 'info') {
  const container = document.getElementById('notificationContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `notification-toast notification-${type}`;

  const icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ');

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <div class="toast-body">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button type="button" class="toast-close" aria-label="Close notification">✕</button>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => removeNotification(toast));

  container.appendChild(toast);

  // Auto dismiss after 5 seconds
  setTimeout(() => removeNotification(toast), 5000);
}

function removeNotification(toast) {
  if (!toast || toast.classList.contains('toast-hiding')) return;
  toast.classList.add('toast-hiding');
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 250);
}

// Helper function to prevent XSS attacks by escaping user input
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
