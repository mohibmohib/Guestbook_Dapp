// --- Configuration ---
const CONTRACT_ADDRESS = "0xdC7f7503D1754d633F9875117aC9E1E67db2F447"; // <--- REPLACE THIS
// const NETWORK_ID = "11155111"; // Sepolia Testnet ID

const CONTRACT_ABI = [
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "id",
				"type": "uint256"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "sender",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "name",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "messageText",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "timestamp",
				"type": "uint256"
			}
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
					{
						"internalType": "uint256",
						"name": "id",
						"type": "uint256"
					},
					{
						"internalType": "address",
						"name": "sender",
						"type": "address"
					},
					{
						"internalType": "string",
						"name": "name",
						"type": "string"
					},
					{
						"internalType": "string",
						"name": "messageText",
						"type": "string"
					},
					{
						"internalType": "uint256",
						"name": "timestamp",
						"type": "uint256"
					}
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
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_name",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "_messageText",
				"type": "string"
			}
		],
		"name": "submitMessage",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "totalMessages",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];

// --- Global Variables ---
let web3;
let contract;
let accounts;

// --- Initialization ---

window.addEventListener('load', async () => {
    // Check if MetaMask is installed
    if (typeof window.ethereum !== 'undefined') {
        web3 = new Web3(window.ethereum);
        console.log("Web3 initialized");
        
        // Check if already connected (e.g., on page refresh)
        checkConnection();
        
        // Load messages even before wallet connection (read-only)
        loadBlockchainData();
        
    } else {
        alert("MetaMask is not installed. Please install it to use this DApp.");
        document.getElementById("connectWalletBtn").innerText = "MetaMask Required";
    }
});

// --- Wallet Connection ---

const connectWalletBtn = document.getElementById('connectWalletBtn');

connectWalletBtn.addEventListener('click', async () => {
    if (!accounts) {
        try {
            // Request account access
            accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            onWalletConnected();
        } catch (error) {
            console.error("User denied account access", error);
            alert("Failed to connect wallet. Please try again.");
        }
    } else {
        // Optional: Handle disconnect (though not standard in DApps without specific UI)
        console.log("Wallet already connected:", accounts[0]);
    }
});

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
    connectWalletBtn.innerText = `Connected: ${accounts[0].substring(0, 6)}...${accounts[0].substring(38)}`;
    connectWalletBtn.classList.add('is-connected');
    connectWalletBtn.disabled = true; // Disable connect button after connection
    
    // Enable the submit button now that wallet is connected
    document.getElementById('submitBtn').disabled = false;
    
    // Initialize contract instance with signer (user's account)
    contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS, { from: accounts[0] });
}

// --- Blockchain Interaction (Read & Write) ---

async function loadBlockchainData() {
    try {
        // Initialize read-only contract instance (no from account needed)
        const readOnlyContract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);

        // 1. Get Total Message Count (.call())
        const messageCount = await readOnlyContract.methods.totalMessages().call();
        document.getElementById('totalMessagesDisplay').innerText = messageCount.toString();

        // 2. Get All Messages (.call())
        // Note: The smart contract's getAllMessages() returns them in reverse order (latest first)
        const messages = await readOnlyContract.methods.getAllMessages().call();
        
        // Render messages to the UI
        renderMessages(messages);

    } catch (error) {
        console.error("Error loading blockchain data:", error);
        document.getElementById('loadingMessages').innerText = "Error loading messages. Make sure you are on Sepolia and contract is deployed.";
    }
}

// --- Form Submission ---

const guestbookForm = document.getElementById('guestbookForm');
const visitorMessageInput = document.getElementById('visitorMessage');
const currentCharsDisplay = document.getElementById('currentChars');

// Character Counter Real-time Update
visitorMessageInput.addEventListener('input', () => {
    const currentLength = visitorMessageInput.value.length;
    currentCharsDisplay.innerText = currentLength;
    if (currentLength >= 200) {
        currentCharsDisplay.style.color = 'red';
    } else {
        currentCharsDisplay.style.color = '';
    }
});

guestbookForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!contract || !accounts) {
        alert("Please connect your MetaMask wallet first.");
        return;
    }

    const name = document.getElementById('visitorName').value;
    const message = visitorMessageInput.value;

    // Basic Front-end Validation (Should mirror contract constraints)
    if (name.trim() === '' || message.trim() === '') {
        alert("Both Name and Message are required.");
        return;
    }
    if (message.length > 200) {
        alert("Message must be 200 characters or less.");
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    const originalBtnText = submitBtn.innerText;

    try {
        submitBtn.innerText = "Submitting... (Check MetaMask)";
        submitBtn.disabled = true;

        // Call the smart contract's submitMessage function (.send())
        const receipt = await contract.methods.submitMessage(name, message).send();
        
        console.log("Transaction successful:", receipt);
        
        // Success Feedback
        alert("Message successfully added to the blockchain!");
        
        // Reset Form
        guestbookForm.reset();
        currentCharsDisplay.innerText = "0";

        // Refresh data to show the new message
        await loadBlockchainData();

    } catch (error) {
        console.error("Submission failed:", error);
        alert("Transaction failed or was rejected. Check console for details.");
    } finally {
        // Reset Button State
        submitBtn.innerText = originalBtnText;
        submitBtn.disabled = false;
    }
});

// --- UI Rendering ---

function renderMessages(messages) {
    const container = document.getElementById('messagesContainer');
    container.innerHTML = ''; // Clear existing messages

    if (messages.length === 0) {
        container.innerHTML = '<p class="no-messages">No messages yet. Be the first to sign!</p>';
        return;
    }

    messages.forEach((msg) => {
        // Destructure message data
        const { sender, name, messageText, timestamp } = msg;
        
        // Format Timestamp (convert from Unix epoch to readable date)
        const date = new Date(Number(timestamp) * 1000);
        const dateString = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        
        // Truncate Wallet Address (e.g., 0x1234...abcd)
        const truncatedAddress = `${sender.substring(0, 6)}...${sender.substring(38)}`;

        // Create Message Card Element
        const messageCard = document.createElement('div');
        messageCard.className = 'message-card';
        
        messageCard.innerHTML = `
            <div class="card-header">
                <div class="visitor-info">
                    <span class="visitor-name">${escapeHtml(name)}</span>
                    <span class="wallet-address" title="${sender}">${truncatedAddress}</span>
                </div>
                <span class="timestamp">${dateString}</span>
            </div>
            <div class="card-body">
                <p class="message-text">${escapeHtml(messageText)}</p>
            </div>
            <div class="card-footer">
                <a href="https://sepolia.etherscan.io/address/${sender}" target="_blank" class="etherscan-link">
                    <span class="etherscan-icon">Ξ</span>
                    View on Etherscan
                </a>
            </div>
        `;

        container.appendChild(messageCard);
    });
}

// Helper function to prevent XSS attacks by escaping user input
function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}