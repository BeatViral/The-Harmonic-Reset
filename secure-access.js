const ACCESS_API_BASE = "https://harmonic-reset-access.mahmoodkhanteam.workers.dev";
const PRODUCTS = [
	{ id: "harmonic-reset", name: "The Harmonic Reset" },
];

const form = document.getElementById("access-form");
const statusBox = document.getElementById("access-status");
const successWrap = document.getElementById("access-success");
const accessLink = document.getElementById("access-link");
const verifyBtn = document.getElementById("verify-btn");
const productSelect = document.getElementById("product-id");

if (productSelect) {
	productSelect.innerHTML = PRODUCTS.map((product) => `<option value="${product.id}">${product.name}</option>`).join("");

	const query = new URLSearchParams(window.location.search);
	const requestedProduct = (query.get("product") || "").trim();
	if (requestedProduct && PRODUCTS.some((product) => product.id === requestedProduct)) {
		productSelect.value = requestedProduct;
	}
}

function showStatus(message, isError = false) {
	if (!statusBox) {
		return;
	}

	statusBox.hidden = false;
	statusBox.textContent = message;
	statusBox.style.borderLeftColor = isError ? "#c40000" : "#ffcc00";
}

if (form) {
	form.addEventListener("submit", async (event) => {
		event.preventDefault();

		const formData = new FormData(form);
		const productId = String(formData.get("productId") || "").trim();
		const email = String(formData.get("email") || "").trim().toLowerCase();
		const receipt = String(formData.get("receipt") || "").trim();

		if (!productId || !email || !receipt) {
			showStatus("Please select product and enter both purchase email and receipt ID.", true);
			return;
		}

		if (successWrap) {
			successWrap.hidden = true;
		}

		verifyBtn.disabled = true;
		showStatus("Verifying your purchase. Please wait...");

		try {
			const response = await fetch(`${ACCESS_API_BASE}/request-access`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ productId, email, receipt }),
			});

			const payload = await response.json().catch(() => ({}));

			if (!response.ok || !payload.accessUrl) {
				const errorMessage = payload.message || "We could not verify this purchase yet. Please re-check your details or contact support.";
				showStatus(errorMessage, true);
				return;
			}

			if (accessLink) {
				accessLink.href = payload.accessUrl;
			}

			if (successWrap) {
				successWrap.hidden = false;
			}

			const expiresText = payload.expiresAt ? ` Link expires at ${payload.expiresAt}.` : "";
			showStatus(`Access approved.${expiresText}`);
		} catch (error) {
			showStatus("Verification service is temporarily unavailable. Please try again shortly.", true);
		} finally {
			verifyBtn.disabled = false;
		}
	});
}
