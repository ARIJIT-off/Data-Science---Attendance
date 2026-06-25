// ==========================================================================
// DOM Elements
// ==========================================================================
const viewSignin = document.getElementById('view-signin');
const viewSignupEmail = document.getElementById('view-signup-email');
const viewSignupOtp = document.getElementById('view-signup-otp');
const viewSetPassword = document.getElementById('view-set-password');
const viewSignupSuccess = document.getElementById('view-signup-success');

const formSignin = document.getElementById('form-signin');
const formSignupEmail = document.getElementById('form-signup-email');
const formSignupOtp = document.getElementById('form-signup-otp');
const formSetPassword = document.getElementById('form-set-password');

// Sign In elements
const inputRole = document.getElementById('input-role');
const studentCredentials = document.getElementById('student-credentials');
const signinCredentials = document.getElementById('signin-credentials');
const inputEnrollment = document.getElementById('input-enrollment');
const inputRoll = document.getElementById('input-roll');
const inputSigninEmail = document.getElementById('input-signin-email');
const inputSigninPassword = document.getElementById('input-signin-password');
const rolePills = Array.from(document.querySelectorAll('.role-pill'));
const signupToggle = document.getElementById('signup-toggle');

// Sign Up elements
const inputSignupEmail = document.getElementById('input-signup-email');
const signupRoleLabel = document.getElementById('signup-role-label');
const displaySignupEmail = document.getElementById('display-signup-email');
const signupOtpDigits = Array.from(document.querySelectorAll('.signup-otp-digit'));
const inputNewPassword = document.getElementById('input-new-password');
const inputConfirmPassword = document.getElementById('input-confirm-password');

// Buttons
const btnSignin = document.getElementById('btn-signin');
const btnSignupSendOtp = document.getElementById('btn-signup-send-otp');
const btnSignupVerifyOtp = document.getElementById('btn-signup-verify-otp');
const btnSetPassword = document.getElementById('btn-set-password');

// Navigation Buttons
const btnGotoSignup = document.getElementById('btn-goto-signup');
const btnGotoSignupFromForgot = document.getElementById('btn-goto-signup-from-forgot');
const btnBackToSignin = document.getElementById('btn-back-to-signin');
const btnGotoSigninFromSignup = document.getElementById('btn-goto-signin-from-signup');
const btnBackToSignupEmail = document.getElementById('btn-back-to-signup-email');
const btnGotoSigninAfterSetup = document.getElementById('btn-goto-signin-after-setup');
const btnSignupResendOtp = document.getElementById('btn-signup-resend-otp');

// Utilities
const signupResendTimer = document.getElementById('signup-resend-timer');
const toastContainer = document.getElementById('toast-container');
const passwordToggleBtns = document.querySelectorAll('.password-toggle-btn');

// ==========================================================================
// Application State
// ==========================================================================
let state = {
  role: 'Student', // Default
  signupEmail: '',
  setupToken: '',
  timerInterval: null,
  cooldownSeconds: 30
};

// ==========================================================================
// Toast Notification Utility
// ==========================================================================
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-message">${message}</span>
    <button class="toast-close">&times;</button>
  `;
  toastContainer.appendChild(toast);
  toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));
  setTimeout(() => removeToast(toast), 5000);
}

function removeToast(toast) {
  toast.classList.add('toast-fade-out');
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 300);
}

function shakeCard(cardElement) {
  cardElement.classList.add('shake');
  setTimeout(() => cardElement.classList.remove('shake'), 400);
}

// ==========================================================================
// View Management
// ==========================================================================
function switchView(currentView, nextView) {
  currentView.classList.remove('active');
  currentView.classList.add('hidden');
  setTimeout(() => {
    nextView.classList.remove('hidden');
    nextView.classList.add('active');
  }, 150);
}

function setBtnLoading(button, isLoading) {
  const text = button.querySelector('.btn-text');
  const spinner = button.querySelector('.spinner');
  if (isLoading) {
    button.disabled = true;
    if (text) text.classList.add('hidden');
    if (spinner) spinner.classList.remove('hidden');
  } else {
    button.disabled = false;
    if (text) text.classList.remove('hidden');
    if (spinner) spinner.classList.add('hidden');
  }
}

// ==========================================================================
// Password Visibility Toggle
// ==========================================================================
passwordToggleBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-target');
    const input = document.getElementById(targetId);
    const eyeOpen = btn.querySelector('.eye-open');
    const eyeClosed = btn.querySelector('.eye-closed');

    if (input.type === 'password') {
      input.type = 'text';
      eyeOpen.classList.add('hidden');
      eyeClosed.classList.remove('hidden');
    } else {
      input.type = 'password';
      eyeOpen.classList.remove('hidden');
      eyeClosed.classList.add('hidden');
    }
  });
});

// ==========================================================================
// Role Selection Setup (Sign In View)
// ==========================================================================
function setupRoleSelector() {
  rolePills.forEach(pill => {
    pill.addEventListener('click', () => {
      rolePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const selectedRole = pill.getAttribute('data-role');
      state.role = selectedRole;
      inputRole.value = selectedRole;
      document.body.className = 'role-' + selectedRole;

      document.querySelectorAll('.collage-view').forEach(c => c.classList.remove('active'));
      const activeCollage = document.getElementById('collage-' + selectedRole.toLowerCase());
      if (activeCollage) activeCollage.classList.add('active');

      if (selectedRole === 'Student') {
        studentCredentials.classList.remove('hidden');
        signinCredentials.classList.add('hidden');
        signupToggle.classList.add('hidden');
        inputEnrollment.required = true;
        inputRoll.required = true;
        inputSigninEmail.required = false;
        inputSigninPassword.required = false;
      } else {
        studentCredentials.classList.add('hidden');
        signinCredentials.classList.remove('hidden');
        signupToggle.classList.remove('hidden');
        inputEnrollment.required = false;
        inputRoll.required = false;
        inputSigninEmail.required = true;
        inputSigninPassword.required = true;
      }
    });
  });
}

// ==========================================================================
// Resend Timer Logic (Sign Up)
// ==========================================================================
function startSignupResendTimer() {
  clearInterval(state.timerInterval);
  let timeLeft = state.cooldownSeconds;
  btnSignupResendOtp.disabled = true;
  signupResendTimer.textContent = timeLeft;

  state.timerInterval = setInterval(() => {
    timeLeft--;
    signupResendTimer.textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(state.timerInterval);
      btnSignupResendOtp.disabled = false;
      btnSignupResendOtp.innerHTML = 'Resend OTP';
    } else {
      btnSignupResendOtp.innerHTML = `Resend in <span id="signup-resend-timer">${timeLeft}</span>s`;
    }
  }, 1000);
}

function stopSignupResendTimer() {
  clearInterval(state.timerInterval);
  btnSignupResendOtp.disabled = true;
  btnSignupResendOtp.innerHTML = 'Resend in <span id="signup-resend-timer">30</span>s';
}

// ==========================================================================
// OTP Digit Focus & Flow (Sign Up)
// ==========================================================================
function setupSignupOtpInputs() {
  signupOtpDigits.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value;
      if (!/^\d*$/.test(val)) {
        e.target.value = '';
        updateSignupVerifyButtonState();
        return;
      }
      if (val !== '' && index < signupOtpDigits.length - 1) {
        signupOtpDigits[index + 1].focus();
      }
      updateSignupVerifyButtonState();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        if (input.value === '' && index > 0) {
          signupOtpDigits[index - 1].focus();
          signupOtpDigits[index - 1].value = '';
        } else {
          input.value = '';
        }
        updateSignupVerifyButtonState();
        e.preventDefault();
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = (e.clipboardData || window.clipboardData).getData('text');
      const numericString = pasteData.replace(/\D/g, '').substring(0, 4);
      if (numericString.length > 0) {
        for (let i = 0; i < signupOtpDigits.length; i++) {
          signupOtpDigits[i].value = i < numericString.length ? numericString[i] : '';
        }
        const targetIndex = Math.min(numericString.length, signupOtpDigits.length - 1);
        signupOtpDigits[targetIndex].focus();
        updateSignupVerifyButtonState();
      }
    });
  });
}

function updateSignupVerifyButtonState() {
  const isFilled = signupOtpDigits.every(input => input.value !== '');
  btnSignupVerifyOtp.disabled = !isFilled;
}

function clearSignupOtpInputs() {
  signupOtpDigits.forEach(input => input.value = '');
  updateSignupVerifyButtonState();
}

// ==========================================================================
// Form Event Handlers
// ==========================================================================

// 1. SIGN IN (Student or Admin/Teacher)
formSignin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const role = state.role;

  if (role === 'Student') {
    const enrollmentNo = inputEnrollment.value.trim();
    const rollNo = inputRoll.value.trim();
    if (!enrollmentNo || !rollNo) {
      showToast('Enrollment number and Class Roll number are required.', 'error');
      shakeCard(viewSignin);
      return;
    }
    setBtnLoading(btnSignin, true);
    try {
      const res = await fetch('/api/student-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentNo, rollNo })
      });
      const result = await res.json();
      setBtnLoading(btnSignin, false);
      if (result.success) {
        sessionStorage.setItem('user', JSON.stringify(result.user));
        window.location.href = 'student.html';
      } else {
        showToast(result.message, 'error');
        shakeCard(viewSignin);
      }
    } catch (err) {
      setBtnLoading(btnSignin, false);
      showToast('Server error. Please try again.', 'error');
      shakeCard(viewSignin);
    }
  } else {
    // Admin / Teacher Password Sign In
    const email = inputSigninEmail.value.trim();
    const password = inputSigninPassword.value.trim();
    
    if (!email || !password) {
      showToast('Email and password are required.', 'error');
      shakeCard(viewSignin);
      return;
    }

    setBtnLoading(btnSignin, true);
    try {
      const res = await fetch('/api/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role })
      });
      const result = await res.json();
      setBtnLoading(btnSignin, false);
      if (result.success) {
        sessionStorage.setItem('user', JSON.stringify(result.user));
        window.location.href = role.toLowerCase() + '.html';
      } else {
        showToast(result.message, 'error');
        shakeCard(viewSignin);
        if (result.message.includes("sign up first")) {
          // Highlight sign up link
          signupToggle.classList.add('shake');
          setTimeout(() => signupToggle.classList.remove('shake'), 400);
        }
      }
    } catch (err) {
      setBtnLoading(btnSignin, false);
      showToast('Server error. Please try again.', 'error');
      shakeCard(viewSignin);
    }
  }
});

// 2. SIGN UP - Send OTP
formSignupEmail.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = inputSignupEmail.value.trim();
  if (!email) return;

  setBtnLoading(btnSignupSendOtp, true);
  try {
    const res = await fetch('/api/signup/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role: state.role })
    });
    const result = await res.json();
    setBtnLoading(btnSignupSendOtp, false);

    if (result.success) {
      state.signupEmail = result.email || email;
      displaySignupEmail.textContent = state.signupEmail;
      clearSignupOtpInputs();
      switchView(viewSignupEmail, viewSignupOtp);
      setTimeout(() => signupOtpDigits[0].focus(), 300);
      startSignupResendTimer();
      showToast(result.message, 'success');
    } else {
      showToast(result.message, 'error');
      shakeCard(viewSignupEmail);
    }
  } catch (err) {
    setBtnLoading(btnSignupSendOtp, false);
    showToast('Server error. Please try again.', 'error');
    shakeCard(viewSignupEmail);
  }
});

// 3. SIGN UP - Verify OTP
formSignupOtp.addEventListener('submit', async (e) => {
  e.preventDefault();
  const otp = signupOtpDigits.map(i => i.value).join('');
  if (otp.length !== 4) {
    showToast('Please enter the 4-digit code.', 'error');
    shakeCard(viewSignupOtp);
    return;
  }

  setBtnLoading(btnSignupVerifyOtp, true);
  try {
    const res = await fetch('/api/signup/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: state.signupEmail, otp })
    });
    const result = await res.json();
    setBtnLoading(btnSignupVerifyOtp, false);

    if (result.success) {
      state.setupToken = result.setupToken;
      inputNewPassword.value = '';
      inputConfirmPassword.value = '';
      switchView(viewSignupOtp, viewSetPassword);
      setTimeout(() => inputNewPassword.focus(), 300);
      stopSignupResendTimer();
      showToast(result.message, 'success');
    } else {
      showToast(result.message, 'error');
      shakeCard(viewSignupOtp);
      clearSignupOtpInputs();
      signupOtpDigits[0].focus();
    }
  } catch (err) {
    setBtnLoading(btnSignupVerifyOtp, false);
    showToast('Server error. Please try again.', 'error');
    shakeCard(viewSignupOtp);
  }
});

// 4. SIGN UP - Set Password
formSetPassword.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = inputNewPassword.value;
  const confirm = inputConfirmPassword.value;

  if (password.length !== 4 || !/^\d{4}$/.test(password)) {
    showToast('Password must be exactly 4 digits.', 'error');
    shakeCard(viewSetPassword);
    return;
  }

  if (password !== confirm) {
    showToast('Passwords do not match.', 'error');
    shakeCard(viewSetPassword);
    return;
  }

  setBtnLoading(btnSetPassword, true);
  try {
    const res = await fetch('/api/signup/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: state.signupEmail, password, setupToken: state.setupToken })
    });
    const result = await res.json();
    setBtnLoading(btnSetPassword, false);

    if (result.success) {
      switchView(viewSetPassword, viewSignupSuccess);
    } else {
      showToast(result.message, 'error');
      shakeCard(viewSetPassword);
    }
  } catch (err) {
    setBtnLoading(btnSetPassword, false);
    showToast('Server error. Please try again.', 'error');
    shakeCard(viewSetPassword);
  }
});

// ==========================================================================
// Navigation Event Handlers
// ==========================================================================
function goToSignup() {
  if (state.role === 'Student') return;
  signupRoleLabel.textContent = state.role;
  inputSignupEmail.value = inputSigninEmail.value; // Carry over email if typed
  switchView(viewSignin, viewSignupEmail);
}

btnGotoSignup.addEventListener('click', goToSignup);
btnGotoSignupFromForgot.addEventListener('click', goToSignup);

btnBackToSignin.addEventListener('click', () => {
  switchView(viewSignupEmail, viewSignin);
});

btnGotoSigninFromSignup.addEventListener('click', () => {
  switchView(viewSignupEmail, viewSignin);
});

btnBackToSignupEmail.addEventListener('click', () => {
  stopSignupResendTimer();
  switchView(viewSignupOtp, viewSignupEmail);
});

btnGotoSigninAfterSetup.addEventListener('click', () => {
  inputSigninEmail.value = state.signupEmail;
  inputSigninPassword.value = '';
  switchView(viewSignupSuccess, viewSignin);
});

btnSignupResendOtp.addEventListener('click', async () => {
  if (btnSignupResendOtp.disabled) return;
  btnSignupResendOtp.disabled = true;
  btnSignupResendOtp.textContent = 'Sending...';
  
  try {
    const res = await fetch('/api/signup/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: state.signupEmail, role: state.role })
    });
    const result = await res.json();
    if (result.success) {
      startSignupResendTimer();
      clearSignupOtpInputs();
      signupOtpDigits[0].focus();
      showToast('A new code has been sent to your email.', 'success');
    } else {
      btnSignupResendOtp.disabled = false;
      btnSignupResendOtp.innerHTML = 'Resend OTP';
      showToast(result.message, 'error');
    }
  } catch (err) {
    btnSignupResendOtp.disabled = false;
    btnSignupResendOtp.innerHTML = 'Resend OTP';
    showToast('Server error.', 'error');
  }
});

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  setupRoleSelector();
  setupSignupOtpInputs();
  await checkStudentCount();
});

async function checkStudentCount() {
  try {
    const res = await fetch('/api/stats/student-count');
    const data = await res.json();
    const studentPill = document.querySelector('.role-pill[data-role="Student"]');
    
    if (data.success && data.count === 0) {
      if (studentPill) {
        studentPill.disabled = true;
        studentPill.title = "Student login is disabled. No students are currently enrolled.";
        studentPill.style.opacity = '0.5';
        studentPill.style.cursor = 'not-allowed';
      }
      if (state.role === 'Student') {
        const teacherPill = document.querySelector('.role-pill[data-role="Teacher"]');
        if (teacherPill) teacherPill.click();
      }
    } else {
       if (studentPill) {
        studentPill.disabled = false;
        studentPill.title = "";
        studentPill.style.opacity = '1';
        studentPill.style.cursor = 'pointer';
      }
    }
  } catch (err) {
    console.error('Failed to fetch student count', err);
  }
}
