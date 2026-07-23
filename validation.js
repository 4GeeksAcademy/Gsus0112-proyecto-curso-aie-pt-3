document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("trackflow-b2b-form");
    if (!form) return;

    const fields = {
        companyName: document.getElementById("company-name"),
        corporateEmail: document.getElementById("corporate-email"),
        contactPhone: document.getElementById("contact-phone"),
        monthlyVolume: document.getElementById("monthly-volume")
    };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const phoneRegex = /^\+?[0-9\s()\-]{7,20}$/;

    const validators = {
        companyName: (value) => {
            if (!value.trim()) return "El nombre de la empresa es obligatorio.";
            if (value.trim().length < 2) return "El nombre debe tener al menos 2 caracteres.";
            return "";
        },
        corporateEmail: (value) => {
            if (!value.trim()) return "El email corporativo es obligatorio.";
            if (!emailRegex.test(value.trim())) return "Introduce un email con formato válido.";
            return "";
        },
        contactPhone: (value) => {
            if (!value.trim()) return "El teléfono es obligatorio.";
            const digits = value.replace(/\D/g, "");
            if (!phoneRegex.test(value.trim()) || digits.length < 7) {
                return "Introduce un teléfono válido. Ej: +34 600 123 456.";
            }
            return "";
        },
        monthlyVolume: (value) => {
            if (!value.trim()) return "El volumen de envíos es obligatorio.";
            if (Number(value) <= 0) return "El volumen debe ser mayor a 0.";
            return "";
        }
    };

    function getErrorElement(input) {
        const errorId = `${input.id}-error`;
        let errorElement = document.getElementById(errorId);
        if (!errorElement) {
            errorElement = document.createElement("p");
            errorElement.id = errorId;
            errorElement.className = "mt-1.5 text-sm font-medium text-red-500";
            input.insertAdjacentElement("afterend", errorElement);
        }
        return errorElement;
    }

    function showError(input, message) {
        const errorElement = getErrorElement(input);
        errorElement.textContent = message;
        input.classList.remove("border-slate-300", "focus:border-emerald-500", "focus:ring-emerald-500");
        input.classList.add("border-red-500", "focus:border-red-500", "focus:ring-red-500");
    }

    function hideError(input) {
        const errorElement = getErrorElement(input);
        errorElement.textContent = "";
        input.classList.remove("border-red-500", "focus:border-red-500", "focus:ring-red-500");
        input.classList.add("border-slate-300", "focus:border-emerald-500", "focus:ring-emerald-500");
    }

    function validateField(fieldKey) {
        const input = fields[fieldKey];
        const errorMessage = validators[fieldKey](input.value);
        if (errorMessage) {
            showError(input, errorMessage);
            return false;
        }
        hideError(input);
        return true;
    }

    function showSuccessMessage() {
        const existing = document.getElementById("success-msg");
        if (existing) existing.remove();
        
        const successBox = document.createElement("div");
        successBox.id = "success-msg";
        successBox.className = "mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800";
        successBox.textContent = "¡Solicitud recibida! Nuestro equipo analizará tu volumen operativo y te contactará pronto.";
        form.insertAdjacentElement("beforebegin", successBox);
    }

    Object.keys(fields).forEach((key) => {
        const input = fields[key];
        input.addEventListener("blur", () => validateField(key));
        input.addEventListener("input", () => {
            if (input.classList.contains("border-red-500")) validateField(key);
        });
    });

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const existingSuccess = document.getElementById("success-msg");
        if (existingSuccess) existingSuccess.remove();

        const isFormValid = Object.keys(fields).every((key) => validateField(key));
        
        if (isFormValid) {
            showSuccessMessage();
            form.reset();
            Object.values(fields).forEach(input => hideError(input));
        }
    });

    form.addEventListener("reset", () => {
        const existingSuccess = document.getElementById("success-msg");
        if (existingSuccess) existingSuccess.remove();
        Object.values(fields).forEach(input => hideError(input));
    });
});