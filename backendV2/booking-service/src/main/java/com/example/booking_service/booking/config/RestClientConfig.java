package com.example.booking_service.booking.config;

import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {

    // Plain (non-load-balanced) builder. @Primary so unqualified RestClient.Builder
    // injection points get THIS one — most importantly the Eureka client's own HTTP
    // transport, which registers against a literal host (localhost:8761). Without this,
    // the only RestClient.Builder bean is the @LoadBalanced one below and Eureka tries
    // to load-balance "localhost" as a service name → "No instances available for localhost".
    @Bean
    @Primary
    public RestClient.Builder restClientBuilder() {
        return RestClient.builder();
    }

    // Eureka-aware builder, selected explicitly via the @LoadBalanced qualifier, so
    // "http://payment-service" resolves through the registry for the PaymentClient call.
    @Bean
    @LoadBalanced
    public RestClient.Builder loadBalancedRestClientBuilder() {
        return RestClient.builder();
    }
}
