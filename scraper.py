from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from time import sleep

def scrape_ola_fare(pickup, drop):
    url = "https://www.olacabs.com/"
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")  # Run in background
    driver = webdriver.Chrome(options=options)

    driver.get(url)
    sleep(5)  # Allow page to load

    try:
        # Enter Pickup Location
        pickup_input = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "textbox1"))  # Corrected ID
        )
        pickup_input.clear()
        pickup_input.send_keys(pickup)
        sleep(2)
        pickup_input.send_keys(Keys.RETURN)
        sleep(3)

        # Enter Drop Location
        drop_input = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "destination_location"))  # Corrected ID
        )
        drop_input.clear()
        drop_input.send_keys(drop)
        sleep(2)
        drop_input.send_keys(Keys.RETURN)
        sleep(5)  # Increased wait time for fares to load

        # Scroll down to ensure fare is visible
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        sleep(3)

        # Extract Fare Estimates using correct class name "price-estimate"
        fare_elements = driver.find_elements(By.CLASS_NAME, "price-estimate")  
        fares = {}

        for index, fare in enumerate(fare_elements, start=1):
            price_text = fare.text.strip()
            if "₹" in price_text:  # Ensure we get valid prices
                fares[f"Ola Ride {index}"] = price_text

    except Exception as e:
        print("Error scraping Ola fares:", e)
        fares = {"error": "Failed to fetch fares"}
    
    driver.quit()
    return fares

if __name__ == "__main__":
    pickup = "Hyderabad"
    drop = "Bangalore"
    ola_fares = scrape_ola_fare(pickup, drop)
    print(ola_fares)
