package com.doteloper.openai.controller

import com.doteloper.openai.client.OpenAiClient
import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.CrossOrigin
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter

@CrossOrigin
@RestController
@RequestMapping("/api/chat")
class ChatController(
    private val openAiClient: OpenAiClient,
) {
    @GetMapping(produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
    fun chat(@RequestParam("query") message: String): SseEmitter {
        return openAiClient.chatCompletion(message)
    }
}
