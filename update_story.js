const fs = require('fs');
let c = fs.readFileSync('js/pages/feeds.js', 'utf8');

const newComposer = `function openStoryComposer() {
  let modal = document.getElementById('story-composer-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'story-composer-modal';
    modal.style.cssText = 'position:fixed; inset:0; z-index:99999; background:#000; display:flex; flex-direction:column; opacity:0; transition:opacity 0.3s ease; overflow:hidden;';
    document.body.appendChild(modal);
  }
  modal.innerHTML = \`
    <!-- Video Background -->
    <video id="story-camera-feed" autoplay playsinline muted style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:1; transform:scaleX(-1);"></video>
    
    <!-- Dim Overlay for better text visibility -->
    <div style="position:absolute; inset:0; background:rgba(0,0,0,0.25); z-index:2;"></div>

    <!-- Top Left Navigation -->
    <div style="position:absolute; top:40px; left:20px; z-index:100000; display:flex; align-items:center;">
      <button class="icon-btn" onclick="closeStoryComposer()" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:40px; height:40px; border-radius:50%; display:flex; justify-content:center; align-items:center; border:1px solid rgba(255,255,255,0.2);">
        <span class="material-symbols-rounded">arrow_back</span>
      </button>
    </div>

    <!-- Top Right Vertical Toolbar -->
    <div style="position:absolute; top:40px; right:20px; z-index:100000; display:flex; flex-direction:column; gap:16px;">
      <button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);" onclick="document.getElementById('story-compose-input').focus()">
        <span class="material-symbols-rounded" style="font-size:22px;">match_case</span>
      </button>
      <button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);">
        <span class="material-symbols-rounded" style="font-size:22px;">mood</span>
      </button>
      <button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);">
        <span class="material-symbols-rounded" style="font-size:22px;">music_note</span>
      </button>
      <button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);">
        <span class="material-symbols-rounded" style="font-size:22px;">auto_awesome</span>
      </button>
      <button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);">
        <span class="material-symbols-rounded" style="font-size:22px;">alternate_email</span>
      </button>
      <button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);">
        <span class="material-symbols-rounded" style="font-size:22px;">draw</span>
      </button>
      <button class="icon-btn" style="background:rgba(0,0,0,0.5); color:#fff; backdrop-filter:blur(10px); width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,0.2);">
        <span class="material-symbols-rounded" style="font-size:22px;">download</span>
      </button>
    </div>
    
    <!-- Central Text Canvas -->
    <div style="flex:1; display:flex; align-items:center; justify-content:center; position:relative; z-index:10; pointer-events:none;">
      <textarea id="story-compose-input" placeholder="Type something amazing..." style="pointer-events:auto; background:transparent; border:none; outline:none; color:#fff; font-size:36px; font-weight:800; text-align:center; width:80%; resize:none; text-shadow:0 4px 16px rgba(0,0,0,0.6)" rows="3" autofocus></textarea>
    </div>

    <!-- Bottom Sharing Footer -->
    <div style="position:absolute; bottom:30px; left:20px; right:20px; z-index:100000; display:flex; justify-content:space-between; align-items:center;">
      <div style="display:flex; gap:16px;">
        <!-- Your Story -->
        <button class="btn" style="background:rgba(0,0,0,0.5); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.2); border-radius:30px; padding:8px 16px; display:flex; align-items:center; gap:8px; color:#fff; font-weight:600;" onclick="submitStory('Your Story')">
          <div style="width:24px; height:24px; border-radius:50%; background:var(--g-brand); display:grid; place-items:center; font-size:10px;">AV</div>
          Your Story
        </button>
        <!-- Close Friends -->
        <button class="btn" style="background:rgba(0,0,0,0.5); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.2); border-radius:30px; padding:8px 16px; display:flex; align-items:center; gap:8px; color:#fff; font-weight:600;" onclick="submitStory('Close Friends')">
          <div style="width:24px; height:24px; border-radius:50%; background:var(--green); display:grid; place-items:center;">
            <span class="material-symbols-rounded" style="font-size:16px; color:#fff;">stars</span>
          </div>
          Close Friends
        </button>
      </div>
      <!-- Send Button -->
      <button class="icon-btn" style="width:56px; height:56px; border-radius:50%; background:var(--blue); color:#fff; box-shadow:0 4px 16px rgba(33,150,243,0.4); display:grid; place-items:center; border:none;" onclick="submitStory('Direct Message')">
        <span class="material-symbols-rounded" style="font-size:28px;">send</span>
      </button>
    </div>
  \`;
  modal.style.display = 'flex';
  setTimeout(() => modal.style.opacity = '1', 10);

  // Request Camera Access
  const videoEl = document.getElementById('story-camera-feed');
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then(function(stream) {
        window.currentStoryStream = stream;
        videoEl.srcObject = stream;
      })
      .catch(function(err) {
        console.warn("Camera access denied or unavailable: ", err);
        // Fallback gradient if camera fails
        videoEl.style.display = 'none';
        modal.style.background = 'linear-gradient(135deg, var(--g-brand))';
      });
  } else {
    videoEl.style.display = 'none';
    modal.style.background = 'linear-gradient(135deg, var(--g-brand))';
  }
}

function closeStoryComposer() {
  const modal = document.getElementById('story-composer-modal');
  if (modal) {
    modal.style.opacity = '0';
    setTimeout(() => {
      modal.style.display = 'none';
      // Stop camera stream to free up resources
      if (window.currentStoryStream) {
        window.currentStoryStream.getTracks().forEach(track => track.stop());
        window.currentStoryStream = null;
      }
    }, 300);
  }
}

function submitStory(destination = 'Your Story') {
  closeStoryComposer();
  showToast(\`Shared to \${destination}! ✨\`);
}`;

const re = /function openStoryComposer\(\) \{[\s\S]*?function submitStory\(\) \{[\s\S]*?showToast\('Story Uploaded Successfully! ✨'\);\n\}/;
c = c.replace(re, newComposer);
fs.writeFileSync('js/pages/feeds.js', c);
console.log('Story Composer updated');
