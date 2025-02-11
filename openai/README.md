# [SpringBoot/Kotlin] SSE 활용한 AI Streaming Chat  구현 (w. React)
### 미리보기

![화면 기록 2025-02-11 오후 9 52 51](https://github.com/user-attachments/assets/98e6ff52-bc05-41b3-aeb2-88e88081e39d)


Spring Boot와 SSE를 활용하여 AI Streaming Chat 서비스를 구현하였다.

사실 채팅 스트리밍을 구현하기 위한 다양한 언어, 기술이 많지만 현업에서 사용하는 언어와 SSE를 경험하고 싶어 해당 기술스택을 활용하였다. 

(즉, 스트리밍 채팅을 구현하기 위한 기술 스택은 다양하므로 상황과 조건에 맞게 사용하길 바란다.)

# SSE(Server-Sent-Event)란?

클라이언트가 서버로부터 **단방향 스트리밍** 데이터를 받을 수 있도록 지원하는 기술이다.

- **단방향 통신**: 서버에서 클라이언트로만 데이터를 전송할 수 있음
- **HTTP 기반**: 기존 HTTP 프로토콜을 사용하기 때문에 방화벽 및 프록시 환경에서 사용하기 용이함
- **자동 재연결**: 클라이언트에서 SSE 연결이 끊어졌을 경우 자동으로 재연결하는 기능 제공
- **텍스트 기반 전송**: JSON, XML 등의 데이터를 텍스트로 전송 가능
- 손쉬운 구현: 다양한 API로 제공되어 간단하게 사용할 수 있음

# Spring Boot SseEmitter

Spring Boot에서는 `SseEmitter` 클래스를 제공하여 SSE를 쉽게 구현할 수 있다. ([docs](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/mvc/method/annotation/SseEmitter.html))

### 주요 메소드

| 메서드 | 설명 |
| --- | --- |
| `send(Object data)` | 클라이언트에게 데이터를 전송 |
| `complete()` | SSE 스트림을 정상적으로 종료 |
| `completeWithError(Throwable t)` | 오류 발생 시 스트림 종료 |
| `onCompletion(Runnable callback)` | 스트림 완료 시 실행할 콜백 지정 |
| `onTimeout(Runnable callback)` | 스트림이 타임아웃될 경우 실행할 콜백 지정 |

# AI Streaming Chat with SseEmitter

## OpenAiClient.kt

### OpenAI API Request

OpenAI 의 ChatCompletion API 를 위한 Request를 생성한다. ([openai docs](https://platform.openai.com/docs/api-reference/chat))

해당 프로젝트는 정교한 설정이 필요하지 않아, 필수 값만 채워넣을 수 있는 DTO로 구현하였다.

```kotlin
val request = ChatCompletionRequest.build(message)

// Request DTO
data class ChatCompletionRequest(
    val model: String = "gpt-3.5-turbo",
    val messages: List<ChatCompletionMessageRequest>,
    val stream: Boolean = true, // --- (1)
) {
    data class ChatCompletionMessageRequest(
        val role: String = "user",
        val content: String,
    )

    companion object {
        fun build(message: String): ChatCompletionRequest = ChatCompletionRequest(
            messages = listOf(
                ChatCompletionMessageRequest(
                    content = message
                )
            )
        )
    }
}
```

1. 응답을 Streaming으로 받아야하기 때문에, 해당 값은 `true`로 설정하자.
만약, 한번에 응답을 받고 싶다면 필드 값을 설정하지 않거나 `false`로 설정하면된다.

### WebClient

우선, OpenAI에서 ChatCompletion API에서 어떻게 응답이 오는지 확인해보자.

![image](https://github.com/user-attachments/assets/9b74a16c-54d8-4121-a2e6-f4a0c73f7b77)


이를 위해, **응답 파싱에 주의를 기울여야 한다는 것**을 알 수 있다.

그럼 아래 `WebClient` 코드를 보자.

```kotlin
fun chatCompletion(message: String): SseEmitter {
    val request = ChatCompletionRequest.build(message)

    return SseEmitter().also { emitter ->
        WebClient.create()
            .post()
            .uri("https://api.openai.com/v1/chat/completions")
            .contentType(MediaType.APPLICATION_JSON)
            .header("Authorization", "Bearer $token")
            .body(BodyInserters.fromValue(request))
            .exchangeToFlux { response -> response.bodyToFlux<String>() } // --- (1)
            .doOnNext { data -> // --- (2)
                if (data.equals("[DONE]")) {
                    emitter.complete()
                } else {
                    objectMapper.readValue(data, ChatCompletionResponse::class.java).getContent()
                        ?.let { emitter.send("\"$it\"") }
                }
            }
            .doOnComplete(emitter::complete)
            .doOnError(emitter::completeWithError)
            .subscribe()
    }
}
```

1. `exchangeToFlux`: 서버로부터 받은 응답을 `Flux<String>`으로 변환
    1. `Flux`: 0개 이상의 데이터를 비동기적으로 스트리밍할 수 있는 Reactor의 라이브러리
    2. `bodyToFlux<String>()` : 연속된 응답 Chunk를 한 줄씩 `Flux`로 변환하여 비동기적으로 데이터를 스트리밍 할 수 있도록 함
2. `doOnNext`: String으로 선변환 된 데이터로 알맞은 처리를 진행
    1. `"[DONE]"` : 위 실제 open ai 응답에서 보았듯이 위 데이터가 반환된다면 스트리밍 종료를 의미함
        1. `emitter.complete()`: SSE 스트림을 정상적으로 종료시킴
    2. `그 외`: json 형식을 ChatCompletionResponse로 파싱함
        1. `emitter.send(it)` : 변환된 Response 내 content를 가져와 SSE 스트림으로 전송

## ChatController.kt

클라이언트로 SseEmitter로 전송하는 코드를 작성하자.

Chat 응답은 일정한 Json 포맷으로 내려오지만, 응답이 종료되었을 경우 “[DONE]” 텍스트로 내려오는 것을 볼 수 있다. (docs에도 명시되어있음)

```kotlin
@GetMapping(produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
fun chat(@RequestParam("query") message: String): SseEmitter {
    return openAiClient.chatCompletion(message)
}
```

- `MediaType.TEXT_EVENT_STREAM_VALUE`
    - 해당 MediaType을 사용하면, HTTP응답의 Content-Type이 `text/event-stream`으로 설정
        - 이는 SSE 방식으로 데이터를 스트리밍할 것을 나타냄
- `SseEmitter` : 서버에서 이를 반환하면, 클라이언트에서는 `EventSource` API를 사용하여 응답 수신

---

## 결과

해당 API로 요청을 보내면, SSE 응답으로 OpenAI로 받은 응답 한글자씩을 Client로 내려주는 것을 볼 수 있다.
<img width="1271" alt="스크린샷 2025-02-11 오후 9 58 47" src="https://github.com/user-attachments/assets/8f945296-b808-4bcb-a70b-5b1c549eaf4f" />
