// Registers every ENS job handler and approval executor as a side effect of importing the services.
// Imported once by the API router, the MCP route and the worker process.
import "./trips";
import "./gatherings";
import "./split";
import "./concierge/agent";
