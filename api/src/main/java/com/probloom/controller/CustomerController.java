package com.probloom.controller;

import com.probloom.config.CurrentUserResolver;
import com.probloom.model.entity.Customer;
import com.probloom.model.entity.User;
import com.probloom.service.CustomerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;

import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Objects;

@RestController
@RequestMapping("/api/customers")
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customerService;
    private final CurrentUserResolver resolver;

    @GetMapping
    public ResponseEntity<List<Customer>> getAllCustomers(
            @RequestHeader(value = "X-Restaurant-Id", required = false) String xRestaurantId) {
        User owner = resolver.resolveSingleRestaurant(xRestaurantId);
        return ResponseEntity.ok(customerService.getRestaurantCustomers(Objects.requireNonNull(owner.getId())));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Customer> getCustomer(@PathVariable Long id) {
        return ResponseEntity.ok(customerService.getCustomerById(Objects.requireNonNull(id)));
    }

    @PostMapping
    public ResponseEntity<Customer> createCustomer(
            @RequestBody Customer body,
            @RequestHeader(value = "X-Restaurant-Id", required = false) String xRestaurantId) {
        User owner = resolver.resolveSingleRestaurant(xRestaurantId);
        Customer customer = customerService.createOrUpdateCustomer(
                Objects.requireNonNull(owner.getId()),
                Objects.requireNonNull(body.getPhone()),
                body.getName(),
                body.getEmail()
        );
        return ResponseEntity.ok(customer);
    }

    @GetMapping("/phone/{phone}")
    public ResponseEntity<Customer> getCustomerByPhone(
            @PathVariable String phone,
            @RequestHeader(value = "X-Restaurant-Id", required = false) String xRestaurantId) {
        User owner = resolver.resolveSingleRestaurant(xRestaurantId);
        Customer customer = customerService.getCustomerByPhone(Objects.requireNonNull(owner.getId()), Objects.requireNonNull(phone));
        if (customer == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(customer);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCustomer(
            @PathVariable Long id,
            @RequestHeader(value = "X-Restaurant-Id", required = false) String xRestaurantId) {
        User owner = resolver.resolveSingleRestaurant(xRestaurantId);
        Customer customer = customerService.getCustomerById(Objects.requireNonNull(id));
        if (customer != null && customer.getRestaurant().getId().equals(owner.getId())) {
            customerService.deleteCustomer(Objects.requireNonNull(id));
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }
}
