const fs = require('fs');
let code = fs.readFileSync('frontend/src/ChatRoom.jsx', 'utf8');

// Normalize line endings to help replacement
code = code.replace(/\r\n/g, '\n');

// 1. Add isImageUploading state
if (code.indexOf('const [isImageUploading, setIsImageUploading]') === -1) {
  code = code.replace(
    "const [isTyping, setIsTyping] = useState(false);",
    "const [isTyping, setIsTyping] = useState(false);\n  const [isImageUploading, setIsImageUploading] = useState(false);"
  );
  
  code = code.replace(
    "const confirmSendImage = async () => {\n    if (!selectedImage) return;",
    "const confirmSendImage = async () => {\n    if (!selectedImage || isImageUploading) return;\n    setIsImageUploading(true);"
  );
  
  code = code.replace(
    "    } catch (err) {\n      notify.error(\"Gagal mengirim gambar: \" + err.message);\n    }\n    setSelectedImage(null);\n    setImageCaption('');",
    "    } catch (err) {\n      notify.error(\"Gagal mengirim gambar: \" + err.message);\n    } finally {\n      setIsImageUploading(false);\n      setSelectedImage(null);\n      setImageCaption('');\n    }"
  );
  
  code = code.replace(
    "onClick={confirmSendImage} \n              style={{ ",
    "onClick={confirmSendImage} \n              disabled={isImageUploading}\n              style={{ "
  );
  
  code = code.replace(
    "cursor: 'pointer',\n                color: 'white',\n                flexShrink: 0",
    "cursor: isImageUploading ? 'not-allowed' : 'pointer',\n                color: 'white',\n                flexShrink: 0,\n                opacity: isImageUploading ? 0.7 : 1"
  );
  
  code = code.replace(
    "<Send size={18} style={{ marginLeft: '0.5cqw' }} />\n            </button>",
    "{isImageUploading ? <Loader2 size={18} className=\"animate-spin\" /> : <Send size={18} style={{ marginLeft: '0.5cqw' }} />}\n            </button>"
  );
}

// 2. Move MediaMessage
const mediaMsgStartStr = '  const MediaMessage = ({ msg, base64Part';
const renderContentStr = '  const renderMediaContent = (msg, isMe) => {';
const mediaMsgStart = code.indexOf(mediaMsgStartStr);
const mediaMsgEnd = code.indexOf(renderContentStr, mediaMsgStart);

if (mediaMsgStart > 0 && mediaMsgEnd > mediaMsgStart) {
  const mediaMsgCode = code.substring(mediaMsgStart, mediaMsgEnd);
  code = code.substring(0, mediaMsgStart) + code.substring(mediaMsgEnd);
  const chatRoomStart = code.indexOf('const ChatRoom = ({');
  code = code.substring(0, chatRoomStart) + mediaMsgCode.trim() + '\n\n' + code.substring(chatRoomStart);
  console.log('MediaMessage moved');
}

// 3. Add visualViewport resize listener
const hookStartStr = "  const scrollToBottom = (behavior = 'smooth') => {";
const insertCode = `
  useEffect(() => {
    const handleResize = () => {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 150);
    };
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    } else {
      window.addEventListener('resize', handleResize);
    }
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      } else {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);
`;

if (code.indexOf('window.visualViewport.addEventListener') === -1) {
  const hookIdx = code.indexOf(hookStartStr);
  if (hookIdx > 0) {
    code = code.substring(0, hookIdx) + insertCode + '\n' + code.substring(hookIdx);
    console.log('Resize listener added');
  }
}

fs.writeFileSync('frontend/src/ChatRoom.jsx', code);
