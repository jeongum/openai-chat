# **SSE 활용한 AI Streaming Chat 구현 (w. React) - 2탄: 웹 챗 구현**

➡️ 1탄: 서버 구현 ([link](https://doteloper.tistory.com/144#SSE%20%ED%99%9C%EC%9A%A9%ED%95%9C%20AI%20Streaming%20Chat%20%EA%B5%AC%ED%98%84%20(w.%20React)%20-%201%ED%83%84%3A%20%EC%84%9C%EB%B2%84%20%EA%B5%AC%ED%98%84-1))

### 미리보기

![화면 기록 2025-02-11 오후 9 52 51](https://github.com/user-attachments/assets/7df44251-ebe3-49f1-8ba9-7d582c193787)


이번 포스팅은 저번 서버 구현을 받는 웹 채팅에 관련된 코드이다.

사실 이번 프로젝트의 프론트 담당은 “GPT”였다. 따라서 설명의 한계가 있으므로, 중요한 실시간 응답 처리만 간단히 설명하고 마치도록 하겠다.

(‼️‼️‼️‼️‼️ 아래 모든 프론트 코드는 chat gpt로만 만든 코드로 FE 기술과 멀리 떨어져있을 수 있습니다 ‼️‼️‼️‼️‼️)

## 기술 스택

- React (Vite)
- TypeScript
- tailwindcss

### SSE를 이용한 실시간 응답 처리

```tsx
const sendMessage = () => {
  if (!input.trim() || isComposing) return;

  setMessages((prev) => [...prev, { role: "user", text: input }]);
  setInput("");
  setLoading(true);

  const eventSource = new EventSource(`${API_URL}?query=${encodeURIComponent(input)}`);
  let assistantText = "";

  eventSource.onmessage = (event) => {
    assistantText += event.data.replace(/^"|"$/g, "");
    setMessages((prev) => {
      if (prev.length === 0 || prev[prev.length - 1].role !== "assistant") {
        return [...prev, { role: "assistant", text: assistantText }];
      } else {
        return prev.map((msg, index) => index === prev.length - 1 ? { ...msg, text: assistantText } : msg);
      }
    });
  };

  eventSource.onerror = () => {
    eventSource.close();
    setLoading(false);
  };
};
```

- `EventSource`를 사용하여 백엔드에서 오는 스트리밍 데이터를 수신
- `onmessage` 이벤트에서 수신한 데이터를 기존 텍스트에 추가하면서, UI를 실시간으로 업데이트
- 한 글자씩 추가되므로 자연스러운 스트리밍 효과가 구현
- `onerror` 이벤트에서 스트림을 종료하고 로딩 상태를 해제

---

### 전체 코드

https://github.com/jeongum/openai-chat/tree/master/my-sse-chat
