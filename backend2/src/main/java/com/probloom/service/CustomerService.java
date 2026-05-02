package com.probloom.service;

import com.probloom.model.entity.Customer;
import com.probloom.model.entity.User;
import com.probloom.repository.CustomerRepository;
import com.probloom.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.lang.NonNull;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class CustomerService {

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private UserRepository userRepository;

    public List<Customer> getRestaurantCustomers(@NonNull Long restaurantId) {
        return customerRepository.findByRestaurantId(restaurantId);
    }

    public Customer createOrUpdateCustomer(@NonNull Long restaurantId, @NonNull String phone, String name, String email) {
        Optional<Customer> existing = customerRepository.findByRestaurantIdAndPhone(restaurantId, phone);
        if (existing.isPresent()) {
            Customer c = existing.get();
            c.setTotalVisits(c.getTotalVisits() + 1);
            c.setLastVisit(LocalDateTime.now());
            if (name != null && !name.trim().isEmpty()) c.setName(name);
            if (email != null && !email.trim().isEmpty()) c.setEmail(email);
            return customerRepository.save(c);
        }

        User restaurant = userRepository.findById(restaurantId)
            .orElseThrow(() -> new RuntimeException("Restaurant not found"));

        Customer newCustomer = new Customer();
        newCustomer.setRestaurant(restaurant);
        newCustomer.setPhone(phone);
        newCustomer.setName(name);
        newCustomer.setEmail(email);
        newCustomer.setLastVisit(LocalDateTime.now());
        newCustomer.setTotalVisits(1);
        return customerRepository.save(newCustomer);
    }

    public Customer getCustomerById(@NonNull Long id) {
        return customerRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Customer not found"));
    }
}
