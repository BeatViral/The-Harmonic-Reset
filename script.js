document.addEventListener("DOMContentLoaded", () => {
	const ctaButtons = document.querySelectorAll("[data-scroll-target]");

	ctaButtons.forEach((button) => {
		button.addEventListener("click", () => {
			const targetSelector = button.getAttribute("data-scroll-target");
			if (!targetSelector) {
				return;
			}

			const target = document.querySelector(targetSelector);
			if (!target) {
				return;
			}

			target.scrollIntoView({ behavior: "smooth", block: "start" });
		});
	});

	const faqQuestions = document.querySelectorAll(".faq-question");

	faqQuestions.forEach((question) => {
		question.addEventListener("click", () => {
			const item = question.closest(".faq-item");
			if (!item) {
				return;
			}

			const answer = item.querySelector(".faq-answer");
			const isExpanded = question.getAttribute("aria-expanded") === "true";

			faqQuestions.forEach((otherQuestion) => {
				const otherItem = otherQuestion.closest(".faq-item");
				if (!otherItem) {
					return;
				}

				const otherAnswer = otherItem.querySelector(".faq-answer");
				otherQuestion.setAttribute("aria-expanded", "false");
				if (otherAnswer) {
					otherAnswer.hidden = true;
				}
			});

			question.setAttribute("aria-expanded", String(!isExpanded));
			if (answer) {
				answer.hidden = isExpanded;
			}
		});
	});
});
