let username = ""
let token = ""

async function login(user, password) {
  if (user == "" || user == "/") { user = " "   }
  if (password == "" || password == "/") { password = " "}

  const rep = await fetch("https://eddi.cowdie.com:/api/test_user/" + user + "/" + password);
  const data = await rep.json();
  return data

}

async function test_token(user,testtoken) {
  const rep = await fetch("https://eddi.cowdie.com/api/token/" + user + "/" + encodeURIComponent(testtoken));
  const data = await rep.json();
  if (data["error"] == "false") {
    return false;
  }
  if (data["error"] == "true") {
    return true;
  }
}


document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const userInput = document.getElementById("username");
    const passInput = document.getElementById("password");

    const data = await login(userInput.value, passInput.value);

    if (data.message == "true" && await test_token(userInput.value,data.token)) {
        showToast("Login erfolgreich","lightgreen");
        username = userInput.value;
        userInput.value = "";
        passInput.value = "";
        console.log("anfang")
        localStorage.setItem("username",username)
        localStorage.setItem("token",data.token)
        console.log("mitte")
        window.location.href = "/eddi?user=" + username + "&token=" + encodeURIComponent(data.token);
        console.log("ende")
        return;
    }else{
      showToast("fehler","rgb(245, 87, 87)");
    }

});