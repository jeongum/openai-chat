package com.doteloper.openai.client

import com.fasterxml.jackson.annotation.JsonIgnore
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.BodyInserters
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.bodyToFlux
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter

@Component
class OpenAiClient(
    @Value("\${openai.token}") private val token: String,
    private val objectMapper: ObjectMapper,
) {
    fun chatCompletion(message: String): SseEmitter {
        val request = ChatCompletionRequest.build(message)

        return SseEmitter().also { emitter ->
            WebClient.create()
                .post()
                .uri("https://api.openai.com/v1/chat/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", "Bearer $token")
                .body(BodyInserters.fromValue(request))
                .exchangeToFlux { response -> response.bodyToFlux<String>() }
                .doOnNext { data ->
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
}

data class ChatCompletionRequest(
    val model: String = "gpt-3.5-turbo",
    val messages: List<ChatCompletionMessageRequest>,
    val stream: Boolean = true,
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

data class ChatCompletionResponse(
    val choices: List<ChoiceResponse>,
) {
    data class ChoiceResponse(
        val delta: ContentResponse?,
    ) {
        data class ContentResponse(
            val content: String?,
        )
    }

    @JsonIgnore
    fun getContent(): String? {
        return choices.first().delta?.content
    }
}
