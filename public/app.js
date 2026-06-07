// ==========================================================================
// DOM Elements
// ==========================================================================
const viewEmail = document.getElementById('view-email');
const viewOtp = document.getElementById('view-otp');
const viewDashboard = document.getElementById('view-dashboard');

const formEmail = document.getElementById('form-email');
const formOtp = document.getElementById('form-otp');

const inputEmail = document.getElementById('input-email');
const inputRole = document.getElementById('input-role');
const studentCredentials = document.getElementById('student-credentials');
const emailCredentials = document.getElementById('email-credentials');
const inputEnrollment = document.getElementById('input-enrollment');
const inputRoll = document.getElementById('input-roll');
const rolePills = Array.from(document.querySelectorAll('.role-pill'));
const otpDigits = Array.from(document.querySelectorAll('.otp-digit'));

const btnSendOtp = document.getElementById('btn-send-otp');
const btnVerifyOtp = document.getElementById('btn-verify-otp');
const btnResendOtp = document.getElementById('btn-resend-otp');
const btnBackToEmail = document.getElementById('btn-back-to-email');
const btnLogout = document.getElementById('btn-logout');

const displayUserEmail = document.getElementById('display-user-email');
const dashboardName = document.getElementById('dashboard-name');
const dashboardRoleBadge = document.getElementById('dashboard-role-badge');
const profileDetailsList = document.getElementById('profile-details-list');
const resendTimer = document.getElementById('resend-timer');
const toastContainer = document.getElementById('toast-container');

// ==========================================================================
// Application State
// ==========================================================================
let state = {
  email: '',
  role: 'Student', // Default selected role
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
  
  // Close handler
  toast.querySelector('.toast-close').addEventListener('click', () => {
    removeToast(toast);
  });
  
  // Auto remove
  setTimeout(() => {
    removeToast(toast);
  }, 5000);
}

function removeToast(toast) {
  toast.classList.add('toast-fade-out');
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 300);
}

// ==========================================================================
// Card Shake Animation Utility (for errors)
// ==========================================================================
function shakeCard(cardElement) {
  cardElement.classList.add('shake');
  setTimeout(() => {
    cardElement.classList.remove('shake');
  }, 400);
}

// ==========================================================================
// View Management (Transitions)
// ==========================================================================
function switchView(currentView, nextView) {
  currentView.classList.remove('active');
  currentView.classList.add('hidden');
  
  // Delay slightly to allow transition animations
  setTimeout(() => {
    nextView.classList.remove('hidden');
    nextView.classList.add('active');
  }, 150);
}

// ==========================================================================
// Resend Timer Logic
// ==========================================================================
function startResendTimer() {
  clearInterval(state.timerInterval);
  let timeLeft = state.cooldownSeconds;
  
  btnResendOtp.disabled = true;
  resendTimer.textContent = timeLeft;
  
  state.timerInterval = setInterval(() => {
    timeLeft--;
    resendTimer.textContent = timeLeft;
    
    if (timeLeft <= 0) {
      clearInterval(state.timerInterval);
      btnResendOtp.disabled = false;
      btnResendOtp.innerHTML = 'Resend OTP';
    } else {
      btnResendOtp.innerHTML = `Resend in <span id="resend-timer">${timeLeft}</span>s`;
    }
  }, 1000);
}

function stopResendTimer() {
  clearInterval(state.timerInterval);
  btnResendOtp.disabled = true;
  btnResendOtp.innerHTML = 'Resend in <span id="resend-timer">30</span>s';
}

// ==========================================================================
// Spinner Helpers
// ==========================================================================
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
// Role Selection Setup
// ==========================================================================
function setupRoleSelector() {
  rolePills.forEach(pill => {
    pill.addEventListener('click', () => {
      rolePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const selectedRole = pill.getAttribute('data-role');
      state.role = selectedRole;
      inputRole.value = selectedRole;
      
      // Update body class for dynamic font changes
      document.body.className = 'role-' + selectedRole;
      
      // Update collage view
      document.querySelectorAll('.collage-view').forEach(c => c.classList.remove('active'));
      const activeCollage = document.getElementById('collage-' + selectedRole.toLowerCase());
      if (activeCollage) {
        activeCollage.classList.add('active');
      }
      
      // Toggle inputs visibility based on role selection
      if (selectedRole === 'Student') {
        studentCredentials.classList.remove('hidden');
        emailCredentials.classList.add('hidden');
        inputEnrollment.required = true;
        inputRoll.required = true;
        inputEmail.required = false;
      } else {
        studentCredentials.classList.add('hidden');
        emailCredentials.classList.remove('hidden');
        inputEnrollment.required = false;
        inputRoll.required = false;
        inputEmail.required = true;
      }
    });
  });
}

// ==========================================================================
// OTP Digit Focus & Flow
// ==========================================================================
function setupOtpInputs() {
  otpDigits.forEach((input, index) => {
    // Only allow numeric input
    input.addEventListener('input', (e) => {
      const val = e.target.value;
      if (!/^\d*$/.test(val)) {
        e.target.value = '';
        updateVerifyButtonState();
        return;
      }
      
      if (val !== '') {
        // Go to next input field
        if (index < otpDigits.length - 1) {
          otpDigits[index + 1].focus();
        }
      }
      updateVerifyButtonState();
    });

    // Handle backspaces
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        if (input.value === '') {
          // Move focus to previous input field and clear it
          if (index > 0) {
            otpDigits[index - 1].focus();
            otpDigits[index - 1].value = '';
          }
        } else {
          // Clear current field
          input.value = '';
        }
        updateVerifyButtonState();
        e.preventDefault();
      }
    });

    // Handle paste event
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = (e.clipboardData || window.clipboardData).getData('text');
      const numericString = pasteData.replace(/\D/g, '').substring(0, 4);
      
      if (numericString.length > 0) {
        for (let i = 0; i < otpDigits.length; i++) {
          if (i < numericString.length) {
            otpDigits[i].value = numericString[i];
          } else {
            otpDigits[i].value = '';
          }
        }
        
        // Focus on the last filled box or last box
        const targetIndex = Math.min(numericString.length, otpDigits.length - 1);
        otpDigits[targetIndex].focus();
        updateVerifyButtonState();
      }
    });
  });
}

function updateVerifyButtonState() {
  const isFilled = otpDigits.every(input => input.value !== '');
  btnVerifyOtp.disabled = !isFilled;
}

function clearOtpInputs() {
  otpDigits.forEach(input => input.value = '');
  updateVerifyButtonState();
}

// ==========================================================================
// Profile Rendering Logic
// ==========================================================================
function renderProfileDetails(user) {
  const profile = user.profile;
  const role = user.role;
  
  // Update badge and name
  dashboardName.textContent = profile.name || 'Anonymous User';
  dashboardRoleBadge.textContent = role;
  
  // Reset badge classes and add current role class
  dashboardRoleBadge.className = 'user-role-badge';
  dashboardRoleBadge.classList.add(`badge-${role}`);
  
  let html = '';
  
  // Basic attributes shared by all
  html += `
    <div class="profile-row">
      <span class="profile-label">Email Address</span>
      <span class="profile-value">${profile.email || user.email}</span>
    </div>
  `;
  
  if (profile.mobile) {
    html += `
      <div class="profile-row">
        <span class="profile-label">Mobile Number</span>
        <span class="profile-value">${profile.mobile}</span>
      </div>
    `;
  }

  // Role specific details
  if (role === 'Admin') {
    html += `
      <div class="profile-row">
        <span class="profile-label">Designation</span>
        <span class="profile-value">${profile.role || 'Administrator'}</span>
      </div>
    `;
    if (profile.department) {
      html += `
        <div class="profile-row">
          <span class="profile-label">Department</span>
          <span class="profile-value">${profile.department}</span>
        </div>
      `;
    }
  } else if (role === 'Teacher') {
    // Show designated status
    html += `
      <div class="profile-row">
        <span class="profile-label">Designation</span>
        <span class="profile-value">Faculty Member of Data Science</span>
      </div>
    `;
  } else if (role === 'Student') {
    if (profile.department) {
      html += `
        <div class="profile-row">
          <span class="profile-label">Department</span>
          <span class="profile-value">${profile.department}</span>
        </div>
      `;
    }
    
    // Check if they have a Supervisor (Supervisor Name)
    if (profile.supervisorName) {
      html += `
        <div class="profile-subsection">
          <div class="subsection-title">Academic Supervisor Details</div>
          <div class="subsection-row">
            <span class="subsection-label">Supervisor Name</span>
            <span class="subsection-value">${profile.supervisorName}</span>
          </div>
          <div class="subsection-row">
            <span class="subsection-label">Supervisor Email</span>
            <span class="subsection-value">${profile.supervisorEmail || 'N/A'}</span>
          </div>
          <div class="subsection-row">
            <span class="subsection-label">Supervisor Mobile</span>
            <span class="subsection-value">${profile.supervisorMobile || 'N/A'}</span>
          </div>
        </div>
      `;
    }
  }
  
  profileDetailsList.innerHTML = html;
}

// ==========================================================================
// API Operations
// ==========================================================================
async function sendOtpRequest(email, role, enrollmentNo = null, rollNo = null) {
  try {
    const response = await fetch('/api/send-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, role, enrollmentNo, rollNo })
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, message: 'Server unreachable. Check your connection.' };
  }
}

async function verifyOtpRequest(email, otp) {
  try {
    const response = await fetch('/api/verify-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, otp })
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, message: 'Server unreachable. Check your connection.' };
  }
}

// ==========================================================================
// Form Event Handlers
// ==========================================================================
formEmail.addEventListener('submit', async (e) => {
  e.preventDefault();
  const role = state.role;
  
  if (role === 'Student') {
    const enrollmentNo = inputEnrollment.value.trim();
    const rollNo = inputRoll.value.trim();
    
    if (!enrollmentNo || !rollNo) {
      showToast('Enrollment number and Class Roll number are required.', 'error');
      shakeCard(viewEmail);
      return;
    }
    
    setBtnLoading(btnSendOtp, true);
    
    // Direct Login API for Student
    try {
      const response = await fetch('/api/student-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentNo, rollNo })
      });
      const result = await response.json();
      
      setBtnLoading(btnSendOtp, false);
      
      if (result.success) {
        // Store user data in sessionStorage and redirect to student dashboard
        sessionStorage.setItem('user', JSON.stringify(result.user));
        window.location.href = 'student.html';
      } else {
        showToast(result.message, 'error');
        shakeCard(viewEmail);
      }
    } catch (err) {
      setBtnLoading(btnSendOtp, false);
      showToast('Server error. Please try again.', 'error');
      shakeCard(viewEmail);
    }
  } else {
    // Admin or Teacher login (via OTP)
    const email = inputEmail.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Please enter a valid email address.', 'error');
      shakeCard(viewEmail);
      return;
    }
    
    setBtnLoading(btnSendOtp, true);
    const result = await sendOtpRequest(email, role);
    setBtnLoading(btnSendOtp, false);
    
    if (result.success) {
      state.email = result.email || email;
      displayUserEmail.textContent = state.email;
      clearOtpInputs();
      
      switchView(viewEmail, viewOtp);
      setTimeout(() => {
        otpDigits[0].focus();
      }, 300);
      
      startResendTimer();
      showToast(result.message, 'success');
    } else {
      showToast(result.message, 'error');
      shakeCard(viewEmail);
    }
  }
});

formOtp.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const otp = otpDigits.map(input => input.value).join('');
  if (otp.length !== 4) {
    showToast('Please enter the 4-digit code.', 'error');
    shakeCard(viewOtp);
    return;
  }
  
  setBtnLoading(btnVerifyOtp, true);
  
  const result = await verifyOtpRequest(state.email, otp);
  
  setBtnLoading(btnVerifyOtp, false);
  
  if (result.success) {
    // Store user data in sessionStorage and redirect to role-specific page
    sessionStorage.setItem('user', JSON.stringify(result.user));
    const role = result.user.role;
    if (role === 'Student') {
      window.location.href = 'student.html';
    } else if (role === 'Teacher') {
      window.location.href = 'teacher.html';
    } else if (role === 'Admin') {
      window.location.href = 'admin.html';
    } else {
      renderProfileDetails(result.user);
      switchView(viewOtp, viewDashboard);
      showToast(result.message, 'success');
    }
    stopResendTimer();
  } else {
    showToast(result.message, 'error');
    shakeCard(viewOtp);
    clearOtpInputs();
    otpDigits[0].focus();
  }
});

// ==========================================================================
// Navigation Event Handlers
// ==========================================================================
btnBackToEmail.addEventListener('click', () => {
  stopResendTimer();
  switchView(viewOtp, viewEmail);
});

btnResendOtp.addEventListener('click', async () => {
  if (btnResendOtp.disabled) return;
  
  btnResendOtp.disabled = true;
  btnResendOtp.textContent = 'Sending...';
  
  const result = await sendOtpRequest(state.email, state.role);
  
  if (result.success) {
    startResendTimer();
    clearOtpInputs();
    otpDigits[0].focus();
    showToast('A new code has been sent to your email.', 'success');
  } else {
    btnResendOtp.disabled = false;
    btnResendOtp.innerHTML = 'Resend OTP';
    showToast(result.message, 'error');
  }
});

btnLogout.addEventListener('click', () => {
  state.email = '';
  inputEmail.value = '';
  clearOtpInputs();
  switchView(viewDashboard, viewEmail);
  showToast('You have successfully signed out.', 'info');
});

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  setupRoleSelector();
  setupOtpInputs();
});
